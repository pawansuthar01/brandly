import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

type MobileCity = {
  id: string;
  name: string;
  district: string;
};

type MobileState = {
  state: string;
  cities: MobileCity[];
};

const prisma = new PrismaClient();
const outputPath = resolve(
  process.cwd(),
  "../mobile/src/lib/indiaLocations.generated.ts",
);

async function main() {
  const places = await prisma.indiaPlace.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      district: {
        select: {
          name: true,
          state: { select: { name: true } },
        },
      },
    },
    orderBy: [
      { district: { state: { name: "asc" } } },
      { district: { name: "asc" } },
      { name: "asc" },
    ],
  });

  const grouped = new Map<string, MobileCity[]>();
  for (const place of places) {
    const state = place.district.state.name;
    const cities = grouped.get(state) ?? [];
    cities.push({
      id: place.id,
      name: place.name,
      district: place.district.name,
    });
    grouped.set(state, cities);
  }

  const states: MobileState[] = [...grouped.entries()].map(
    ([state, cities]) => ({ state, cities }),
  );
  const output = `/* This file is generated from the official LGD database. Do not edit manually. */\n\nexport type IndiaCity = { id: string; name: string; district: string };\nexport type IndiaState = { state: string; cities: IndiaCity[] };\n\nexport const INDIA_STATES: IndiaState[] = ${JSON.stringify(states, null, 2)};\n`;

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, output, "utf8");
  console.log(
    `Exported ${places.length} official city/town records to ${outputPath}`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
