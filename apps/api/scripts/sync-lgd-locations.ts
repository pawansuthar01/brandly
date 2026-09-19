import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { once } from "node:events";
import { dirname, isAbsolute, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { setDefaultResultOrder } from "node:dns";
import { PrismaClient } from "@prisma/client";

type JsonRecord = Record<string, unknown>;
type DbValue = string | number | boolean | Date | null;
type DbRow = Record<string, DbValue>;

type DataGovPage = {
  total?: number | string;
  updated?: number | string;
  updated_date?: string;
  records?: JsonRecord[];
};

type DatasetName =
  | "states"
  | "districts"
  | "subdistricts"
  | "village-relations"
  | "local-bodies";

type DatasetConfig = {
  resourceId: string;
  sourceDataset: string;
  fileName: string;
};

const DATA_GOV_API_BASE = "https://api.data.gov.in/resource";
const SOURCE = "Government of India · Ministry of Panchayati Raj · LGD";
const PAGE_SIZE = Number(process.env.LGD_PAGE_SIZE ?? 2000);
const API_KEY = process.env.DATA_GOV_IN_API_KEY;

// Some Linux environments prefer the API host's IPv6 address even when the
// route is unavailable. Prefer IPv4 for a reliable server-side scheduled job.
setDefaultResultOrder("ipv4first");

const DATASETS: Record<DatasetName, DatasetConfig> = {
  states: {
    resourceId: "a71e60f0-a21d-43de-a6c5-fa5d21600cdb",
    sourceDataset: "LGD_STATES",
    fileName: "states.ndjson",
  },
  districts: {
    resourceId: "37231365-78ba-44d5-ac22-3deec40b9197",
    sourceDataset: "LGD_DISTRICTS",
    fileName: "districts.ndjson",
  },
  subdistricts: {
    resourceId: "6be51a29-876a-403a-a6da-42fde795e751",
    sourceDataset: "LGD_SUBDISTRICTS",
    fileName: "subdistricts.ndjson",
  },
  "village-relations": {
    resourceId: "c967fe8f-69c4-42df-8afc-8a2c98057437",
    sourceDataset: "LGD_VILLAGE_RELATIONS",
    fileName: "village-relations.ndjson",
  },
  "local-bodies": {
    resourceId: "1a6c26ed-d67c-40ea-aa20-d38d35f341a5",
    sourceDataset: "LGD_LOCAL_BODIES",
    fileName: "local-bodies.ndjson",
  },
};

const IMPORT_ORDER: DatasetName[] = [
  "states",
  "districts",
  "subdistricts",
  "village-relations",
  "local-bodies",
];

const args = new Set(process.argv.slice(2));
const cacheDir = resolvePath(process.env.LGD_CACHE_DIR ?? "./data/lgd");
const shouldRefresh = args.has("--refresh");
const verifyOnly = args.has("--verify-only");
const downloadOnly = args.has("--download-only");

function resolvePath(path: string): string {
  return isAbsolute(path) ? path : resolve(process.cwd(), path);
}

function normaliseKey(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function cleanText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).replace(/\s+/g, " ").trim();
  if (!text || /^(na|n\/a|null|undefined)$/i.test(text)) return null;
  return text;
}

function firstText(record: JsonRecord, ...keys: string[]): string | null {
  const values = new Map(
    Object.entries(record).map(([key, value]) => [normaliseKey(key), value]),
  );
  for (const key of keys) {
    const value = cleanText(values.get(normaliseKey(key)));
    if (value) return value;
  }
  return null;
}

function requiredText(
  record: JsonRecord,
  label: string,
  ...keys: string[]
): string {
  const value = firstText(record, ...keys);
  if (!value)
    throw new Error(`Missing ${label}; expected one of ${keys.join(", ")}`);
  return value;
}

function codeValue(record: JsonRecord, ...keys: string[]): number | null {
  const value = firstText(record, ...keys);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function recordSourceCode(
  record: JsonRecord,
  ...keys: string[]
): string | null {
  return firstText(record, ...keys);
}

function parseDate(value: unknown): Date | null {
  const text = cleanText(value);
  if (!text) return null;
  const date = new Date(
    /^\d{2}-\d{2}-\d{4}$/.test(text)
      ? text.split("-").reverse().join("-")
      : text,
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

function valueUpdatedAt(record: JsonRecord): Date | null {
  return parseDate(
    firstText(record, "last_updated", "data_gov_update_date", "updated_date"),
  );
}

async function fetchPage(
  config: DatasetConfig,
  offset: number,
): Promise<DataGovPage> {
  if (!API_KEY) {
    throw new Error(
      "DATA_GOV_IN_API_KEY is required for LGD downloads and must stay server-side.",
    );
  }

  const url = new URL(`${DATA_GOV_API_BASE}/${config.resourceId}`);
  url.searchParams.set("api-key", API_KEY);
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("limit", String(PAGE_SIZE));
  url.searchParams.set("format", "json");

  for (let attempt = 0; attempt < 7; attempt += 1) {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
    });
    if (response.ok) return (await response.json()) as DataGovPage;

    const body = await response.text();
    if (response.status !== 429 && response.status < 500) {
      throw new Error(
        `LGD request failed (${response.status}): ${body.slice(0, 300)}`,
      );
    }

    const retryAfter = Number(response.headers.get("retry-after") ?? 0);
    const waitMs = retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt;
    console.warn(
      `LGD request throttled; retrying in ${waitMs}ms (${config.sourceDataset}).`,
    );
    await new Promise((resolveWait) => setTimeout(resolveWait, waitMs));
  }

  throw new Error(`LGD request exhausted retries for ${config.sourceDataset}.`);
}

async function downloadDataset(name: DatasetName): Promise<void> {
  const config = DATASETS[name];
  const target = resolve(cacheDir, config.fileName);
  const metadataPath = `${target}.meta.json`;
  if (!shouldRefresh) {
    try {
      await readFile(target);
      await readFile(metadataPath);
      console.log(`Using cached ${config.sourceDataset}: ${target}`);
      return;
    } catch {
      // Cache is incomplete; download it atomically below.
    }
  }

  await mkdir(dirname(target), { recursive: true });
  const temporaryTarget = `${target}.tmp`;
  await rm(temporaryTarget, { force: true });
  const stream = createWriteStream(temporaryTarget, { encoding: "utf8" });
  let offset = 0;
  let total = 0;
  let updatedDate: string | number | undefined;

  try {
    while (true) {
      const page = await fetchPage(config, offset);
      const records = page.records ?? [];
      total = Number(page.total ?? total);
      updatedDate = page.updated_date ?? page.updated ?? updatedDate;

      for (const record of records) {
        if (!stream.write(`${JSON.stringify(record)}\n`))
          await once(stream, "drain");
      }

      offset += records.length;
      console.log(
        `${config.sourceDataset}: ${offset}${total ? `/${total}` : ""}`,
      );
      if (!records.length || (total > 0 && offset >= total)) break;
    }
  } finally {
    stream.end();
    await once(stream, "close");
  }

  await rename(temporaryTarget, target);
  await writeFile(
    metadataPath,
    JSON.stringify(
      {
        source: SOURCE,
        resourceId: config.resourceId,
        total,
        updatedDate,
        downloadedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
}

async function ensureDownloads(): Promise<void> {
  for (const name of IMPORT_ORDER) await downloadDataset(name);
}

async function* readRecords(path: string): AsyncGenerator<JsonRecord> {
  const input = createInterface({
    input: createReadStream(path),
    crlfDelay: Infinity,
  });
  try {
    for await (const line of input) {
      if (line.trim()) yield JSON.parse(line) as JsonRecord;
    }
  } finally {
    input.close();
  }
}

async function upsertBatch(
  table: string,
  conflictColumns: string[],
  columns: string[],
  rows: DbRow[],
): Promise<void> {
  if (!rows.length) return;
  const distinctRows = Array.from(
    new Map(
      rows.map((row) => [
        conflictColumns
          .map((column) => String(row[column] ?? ""))
          .join("\u0000"),
        row,
      ]),
    ).values(),
  );
  const uuidColumns = new Set([
    "id",
    "state_id",
    "district_id",
    "subdistrict_id",
  ]);
  const placeholders = distinctRows
    .map((_, rowIndex) => {
      const start = rowIndex * columns.length;
      return `(${columns
        .map((column, columnIndex) => {
          const placeholder = `$${start + columnIndex + 1}`;
          if (uuidColumns.has(column)) return `${placeholder}::uuid`;
          if (table === "location_states" && column === "kind") {
            return `${placeholder}::"IndiaAdministrativeKind"`;
          }
          if (table === "location_places" && column === "kind") {
            return `${placeholder}::"IndiaPlaceKind"`;
          }
          return placeholder;
        })
        .join(", ")})`;
    })
    .join(", ");
  const updates = columns
    .filter(
      (column) =>
        !["id", "created_at", "updated_at", ...conflictColumns].includes(
          column,
        ),
    )
    .map((column) => `"${column}" = EXCLUDED."${column}"`)
    .concat(['"updated_at" = NOW()'])
    .join(", ");
  const values = distinctRows.flatMap((row) =>
    columns.map((column) => row[column] ?? null),
  );
  const sql = `INSERT INTO "${table}" ("${columns.join('", "')}") VALUES ${placeholders} ON CONFLICT ("${conflictColumns.join('", "')}") DO UPDATE SET ${updates}`;
  await prisma.$executeRawUnsafe(sql, ...values);
}

const prisma = new PrismaClient();

async function importStates(): Promise<{
  count: number;
  ids: Map<number, string>;
}> {
  const rows: DbRow[] = [];
  for await (const record of readRecords(
    resolve(cacheDir, DATASETS.states.fileName),
  )) {
    const lgdCode = codeValue(record, "state_code");
    const name = firstText(record, "state_name_english");
    if (lgdCode === null || !name) continue;
    rows.push({
      id: randomUUID(),
      lgd_code: lgdCode,
      name,
      local_name: firstText(record, "state_name_local"),
      kind:
        firstText(record, "state_or_ut") === "U" ? "UNION_TERRITORY" : "STATE",
      census_2011_code: firstText(record, "state_census2011_code"),
      last_source_updated_at: valueUpdatedAt(record),
      is_active: true,
      updated_at: new Date(),
    });
    if (rows.length === 500) {
      await upsertBatch(
        "location_states",
        ["lgd_code"],
        Object.keys(rows[0]),
        rows.splice(0),
      );
    }
  }
  if (rows.length)
    await upsertBatch(
      "location_states",
      ["lgd_code"],
      Object.keys(rows[0]),
      rows.splice(0),
    );

  const saved = await prisma.$queryRaw<Array<{ id: string; lgd_code: number }>>`
    SELECT id, lgd_code FROM location_states WHERE is_active = true
  `;
  return {
    count: saved.length,
    ids: new Map(saved.map((row) => [Number(row.lgd_code), row.id])),
  };
}

async function importDistricts(
  stateIds: Map<number, string>,
): Promise<{ count: number; ids: Map<number, string> }> {
  const rows: DbRow[] = [];
  for await (const record of readRecords(
    resolve(cacheDir, DATASETS.districts.fileName),
  )) {
    const lgdCode = codeValue(record, "district_code");
    const stateCode = codeValue(record, "state_code");
    const name = firstText(record, "district_name_english");
    const stateId = stateCode === null ? undefined : stateIds.get(stateCode);
    if (lgdCode === null || !name || !stateId) continue;
    rows.push({
      id: randomUUID(),
      lgd_code: lgdCode,
      state_id: stateId,
      name,
      local_name: firstText(record, "district_name_local"),
      census_2011_code: firstText(record, "district_census2011_code"),
      last_source_updated_at: valueUpdatedAt(record),
      is_active: true,
      updated_at: new Date(),
    });
    if (rows.length === 500) {
      await upsertBatch(
        "location_districts",
        ["lgd_code"],
        Object.keys(rows[0]),
        rows.splice(0),
      );
    }
  }
  if (rows.length)
    await upsertBatch(
      "location_districts",
      ["lgd_code"],
      Object.keys(rows[0]),
      rows.splice(0),
    );

  const saved = await prisma.$queryRaw<Array<{ id: string; lgd_code: number }>>`
    SELECT id, lgd_code FROM location_districts WHERE is_active = true
  `;
  return {
    count: saved.length,
    ids: new Map(saved.map((row) => [Number(row.lgd_code), row.id])),
  };
}

async function importSubdistricts(districtIds: Map<number, string>): Promise<{
  count: number;
  ids: Map<number, string>;
  districtIds: Map<number, string>;
}> {
  const rows: DbRow[] = [];
  for await (const record of readRecords(
    resolve(cacheDir, DATASETS.subdistricts.fileName),
  )) {
    const lgdCode = codeValue(record, "subdistrict_code");
    const districtCode = codeValue(record, "district_code");
    const name = firstText(record, "subdistrict_name_english");
    const districtId =
      districtCode === null ? undefined : districtIds.get(districtCode);
    if (lgdCode === null || !name || !districtId) continue;
    rows.push({
      id: randomUUID(),
      lgd_code: lgdCode,
      district_id: districtId,
      name,
      local_name: firstText(record, "subdistrict_name_local"),
      census_2011_code: firstText(record, "subdistrict_census2011_code"),
      last_source_updated_at: valueUpdatedAt(record),
      is_active: true,
      updated_at: new Date(),
    });
    if (rows.length === 500) {
      await upsertBatch(
        "location_subdistricts",
        ["lgd_code"],
        Object.keys(rows[0]),
        rows.splice(0),
      );
    }
  }
  if (rows.length)
    await upsertBatch(
      "location_subdistricts",
      ["lgd_code"],
      Object.keys(rows[0]),
      rows.splice(0),
    );

  const saved = await prisma.$queryRaw<Array<{ id: string; lgd_code: number }>>`
    SELECT id, lgd_code FROM location_subdistricts WHERE is_active = true
  `;
  const savedParents = await prisma.$queryRaw<
    Array<{ lgd_code: number; district_id: string }>
  >`
    SELECT lgd_code, district_id FROM location_subdistricts WHERE is_active = true
  `;
  return {
    count: saved.length,
    ids: new Map(saved.map((row) => [Number(row.lgd_code), row.id])),
    districtIds: new Map(
      savedParents.map((row) => [Number(row.lgd_code), row.district_id]),
    ),
  };
}

async function loadVillageDistrictIds(
  districtIds: Map<number, string>,
): Promise<Map<number, string>> {
  const villageDistrictIds = new Map<number, string>();
  for await (const record of readRecords(
    resolve(cacheDir, DATASETS["village-relations"].fileName),
  )) {
    const villageCode = codeValue(record, "villageCode", "VillageCode");
    const districtCode = codeValue(record, "districtCode", "DistrictCode");
    if (villageCode === null || districtCode === null) continue;
    const districtId = districtIds.get(districtCode);
    if (districtId) villageDistrictIds.set(villageCode, districtId);
  }
  return villageDistrictIds;
}

async function importPlaces(
  districtIds: Map<number, string>,
  subdistrictIds: Map<number, string>,
  subdistrictDistrictIds: Map<number, string>,
  villageDistrictIds: Map<number, string>,
): Promise<{ count: number; skipped: number }> {
  const config = DATASETS["local-bodies"];
  const rows: DbRow[] = [];
  let skipped = 0;

  for await (const record of readRecords(resolve(cacheDir, config.fileName))) {
    const placeSourceCode = recordSourceCode(
      record,
      "local_body_code",
      "localBodyCode",
      "lgd_code",
      "localbodycode",
    );
    const placeName = firstText(
      record,
      "local_body_name_english",
      "localBodyNameEnglish",
      "local_body_name",
      "localBodyName",
    );
    const typeLabel = firstText(
      record,
      "local_body_type_name",
      "localBodyTypeName",
      "local_body_type",
      "localBodyType",
    );
    const entityType =
      firstText(record, "entity_type", "entityType")?.toLowerCase() ?? "";
    const entityCode = codeValue(record, "entity_code", "entityCode");
    const isUrban =
      /urban|municipal|corporation|municipality|nagar|town|notified|cantonment/i.test(
        typeLabel ?? "",
      );
    if (!isUrban) {
      skipped += 1;
      continue;
    }

    // LGD local-body rows point to their covered administrative entity. Use
    // that official code to reach the district; never join on a name.
    const districtId =
      entityCode === null
        ? undefined
        : entityType.includes("district")
          ? districtIds.get(entityCode)
          : entityType.includes("sub")
            ? subdistrictDistrictIds.get(entityCode)
            : entityType.includes("village")
              ? villageDistrictIds.get(entityCode)
              : undefined;
    if (!placeSourceCode || !placeName || !districtId) {
      skipped += 1;
      continue;
    }

    const isTown = /town|notified|nagar panchayat/i.test(typeLabel ?? "");
    rows.push({
      id: randomUUID(),
      source_dataset: config.sourceDataset,
      source_code: placeSourceCode,
      district_id: districtId,
      subdistrict_id:
        entityType.includes("sub") && entityCode !== null
          ? (subdistrictIds.get(entityCode) ?? null)
          : null,
      name: placeName,
      local_name: firstText(
        record,
        "local_body_name_local",
        "localBodyNameLocal",
      ),
      kind: isTown ? "TOWN" : "URBAN_LOCAL_BODY",
      source_type_label: typeLabel,
      source_updated_at: valueUpdatedAt(record),
      is_active: true,
      updated_at: new Date(),
    });
    if (rows.length === 500) {
      await upsertBatch(
        "location_places",
        ["source_dataset", "source_code"],
        Object.keys(rows[0]),
        rows.splice(0),
      );
    }
  }
  if (rows.length)
    await upsertBatch(
      "location_places",
      ["source_dataset", "source_code"],
      Object.keys(rows[0]),
      rows.splice(0),
    );
  // The LGD local-body feed contains repeated coverage rows for some official
  // body codes. Report the persisted unique code count, not raw feed rows.
  const saved = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)
    FROM location_places
    WHERE source_dataset = ${config.sourceDataset} AND is_active = true
  `;
  return { count: Number(saved[0]?.count ?? 0), skipped };
}

async function verify(): Promise<void> {
  const [states, districts, subdistricts, places, kinds, placeKinds] =
    await Promise.all([
      prisma.$queryRaw<
        Array<{ count: bigint }>
      >`SELECT COUNT(*) FROM location_states WHERE is_active = true`,
      prisma.$queryRaw<
        Array<{ count: bigint }>
      >`SELECT COUNT(*) FROM location_districts WHERE is_active = true`,
      prisma.$queryRaw<
        Array<{ count: bigint }>
      >`SELECT COUNT(*) FROM location_subdistricts WHERE is_active = true`,
      prisma.$queryRaw<
        Array<{ count: bigint }>
      >`SELECT COUNT(*) FROM location_places WHERE is_active = true`,
      prisma.$queryRaw<Array<{ kind: string; count: bigint }>>`
      SELECT kind::text, COUNT(*) FROM location_states WHERE is_active = true GROUP BY kind ORDER BY kind
    `,
      prisma.$queryRaw<Array<{ kind: string; count: bigint }>>`
      SELECT kind::text, COUNT(*) FROM location_places WHERE is_active = true GROUP BY kind ORDER BY kind
    `,
    ]);
  const result = {
    states: Number(states[0]?.count ?? 0),
    districts: Number(districts[0]?.count ?? 0),
    subdistricts: Number(subdistricts[0]?.count ?? 0),
    places: Number(places[0]?.count ?? 0),
    stateKinds: Object.fromEntries(
      kinds.map((row) => [row.kind, Number(row.count)]),
    ),
    placeKinds: Object.fromEntries(
      placeKinds.map((row) => [row.kind, Number(row.count)]),
    ),
  };
  console.log(JSON.stringify(result, null, 2));
  if (
    result.states !== 36 ||
    result.stateKinds.STATE !== 28 ||
    result.stateKinds.UNION_TERRITORY !== 8
  ) {
    throw new Error(
      "LGD verification failed: expected 28 states and 8 Union Territories.",
    );
  }
  if (result.districts < 1 || result.places < 1) {
    throw new Error(
      "LGD verification failed: districts and places must both be populated.",
    );
  }
}

async function runImport(): Promise<void> {
  const run = await prisma.locationImportRun.create({
    data: { source: SOURCE, status: "RUNNING" },
  });
  try {
    const states = await importStates();
    const districts = await importDistricts(states.ids);
    const subdistricts = await importSubdistricts(districts.ids);
    const villageDistrictIds = await loadVillageDistrictIds(districts.ids);
    const localBodies = await importPlaces(
      districts.ids,
      subdistricts.ids,
      subdistricts.districtIds,
      villageDistrictIds,
    );
    const skippedRows = localBodies.skipped;
    await prisma.locationImportRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        statesInserted: states.count,
        districtsInserted: districts.count,
        subdistrictsInserted: subdistricts.count,
        placesInserted: localBodies.count,
        skippedRows,
        details: {
          source: SOURCE,
          datasets: IMPORT_ORDER.map((name) => DATASETS[name].resourceId),
          localBodies: localBodies.count,
        },
        completedAt: new Date(),
      },
    });
    await verify();
  } catch (error) {
    await prisma.locationImportRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        details: { error: String(error) },
        completedAt: new Date(),
      },
    });
    throw error;
  }
}

async function main(): Promise<void> {
  if (!verifyOnly && !downloadOnly) await ensureDownloads();
  if (downloadOnly) {
    await ensureDownloads();
    return;
  }
  if (verifyOnly) {
    await verify();
    return;
  }
  await runImport();
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
