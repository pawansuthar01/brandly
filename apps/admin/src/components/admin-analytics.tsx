'use client';

import { Activity, ArrowDownRight, ArrowUpRight, BarChart3, Bell, BriefcaseBusiness, CalendarDays, Check, CircleDollarSign, Download, LoaderCircle, MessageCircle, RefreshCw, Smartphone, Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getAdminAnalytics, type AdminAnalytics, type AdminAnalyticsPoint } from '@/services/adminApi.service';
import styles from './admin-analytics.module.css';

type Period = 7 | 30 | 90 | 365;
const periodOptions: Array<{ days: Period; label: string }> = [{ days: 7, label: '7 days' }, { days: 30, label: '30 days' }, { days: 90, label: '90 days' }, { days: 365, label: '12 months' }];
const dateLabel = (value: string, month: boolean) => new Date(value).toLocaleDateString('en-IN', month ? { month: 'short', year: '2-digit', timeZone: 'UTC' } : { day: 'numeric', month: 'short', timeZone: 'UTC' });
const number = new Intl.NumberFormat('en-IN');
const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

function MetricCard({ icon: Icon, label, value, note, change }: { icon: typeof Users; label: string; value: string; note: string; change?: number }) {
  return <article className={styles.metric}>
    <div className={styles.metricTop}><span className={styles.metricIcon}><Icon size={17} /></span>{change !== undefined && <span className={`${styles.change} ${change < 0 ? styles.changeDown : ''}`}>{change < 0 ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}{change > 0 ? '+' : ''}{number.format(change)}</span>}</div>
    <p>{label}</p><strong>{value}</strong><small>{note}</small>
  </article>;
}

function TrendChart({ points, title, unit = 'count' }: { points: Array<{ label: string; values: Array<{ name: string; value: number; tone: string }> }>; title: string; unit?: 'count' | 'currency' }) {
  const width = 760, height = 235, left = 42, right = 12, top = 14, bottom = 36;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const max = Math.max(1, ...points.flatMap((item) => item.values.map((series) => series.value)));
  const series = points[0]?.values.map((item, index) => ({ name: item.name, tone: item.tone, values: points.map((point) => point.values[index]?.value ?? 0) })) ?? [];
  const x = (index: number) => left + (points.length <= 1 ? plotWidth / 2 : plotWidth * index / (points.length - 1));
  const y = (value: number) => top + plotHeight - plotHeight * value / max;
  const labelEvery = Math.max(1, Math.ceil(points.length / 6));
  return <section className={styles.panel}>
    <div className={styles.panelHeader}><div><h2>{title}</h2><p>Daily activity · comparison period available above</p></div><div className={styles.legend}>{series.map((item) => <span key={item.name}><i className={styles[item.tone as 'toneBlue' | 'toneGreen' | 'toneOrange']} />{item.name}</span>)}</div></div>
    {points.length ? <div className={styles.chartWrap}><svg className={styles.chart} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
      {[0, 1, 2, 3].map((tick) => { const lineY = top + plotHeight * tick / 3; return <g key={tick}><line x1={left} x2={width - right} y1={lineY} y2={lineY} className={styles.gridLine} /><text x={left - 9} y={lineY + 4} textAnchor="end" className={styles.axisLabel}>{unit === 'currency' ? `${Math.round(max * (3 - tick) / 3 / 1000)}k` : number.format(Math.round(max * (3 - tick) / 3))}</text></g>; })}
      {series.map((item) => {
        const d = item.values.map((value, index) => `${index ? 'L' : 'M'} ${x(index)} ${y(value)}`).join(' ');
        const tone = item.tone === 'toneGreen' ? 'Green' : item.tone === 'toneOrange' ? 'Orange' : 'Blue';
        return <g key={item.name}><path d={d} className={styles[`line${tone}`]} />{item.values.map((value, index) => <circle key={`${item.name}-${index}`} cx={x(index)} cy={y(value)} r="3" className={styles[`dot${tone}`]}><title>{`${points[index]?.label}: ${unit === 'currency' ? currency.format(value) : number.format(value)}`}</title></circle>)}</g>;
      })}
      {points.map((point, index) => index % labelEvery === 0 || index === points.length - 1 ? <text key={point.label} x={x(index)} y={height - 8} textAnchor="middle" className={styles.axisLabel}>{point.label}</text> : null)}
    </svg></div> : <div className={styles.empty}>No activity in this period yet.</div>}
  </section>;
}

function Breakdown({ title, rows, emptyLabel }: { title: string; rows: Array<{ label: string; value: number }>; emptyLabel: string }) {
  const maximum = Math.max(1, ...rows.map((row) => row.value));
  return <section className={styles.panel}>
    <div className={styles.panelHeader}><div><h2>{title}</h2><p>Records created in the selected period</p></div><BarChart3 size={18} className={styles.panelIcon} /></div>
    {rows.length ? <div className={styles.breakdown}>{rows.map((row, index) => <div className={styles.breakdownRow} key={row.label}><div><span>{row.label.replaceAll('_', ' ').toLowerCase()}</span><strong>{number.format(row.value)}</strong></div><div className={styles.track}><i style={{ width: `${Math.max(4, row.value / maximum * 100)}%`, opacity: 1 - index * .055 }} /></div></div>)}</div> : <div className={styles.empty}>{emptyLabel}</div>}
  </section>;
}

export function AdminAnalyticsPage() {
  const [days, setDays] = useState<Period>(30);
  const [data, setData] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  useEffect(() => {
    let current = true;
    setLoading(true); setError('');
    getAdminAnalytics(days).then((result) => { if (current) setData(result); })
      .catch((reason: unknown) => { if (current) setError(reason instanceof Error ? reason.message : 'Analytics could not be loaded.'); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [days, refreshKey]);

  const reportPdf = useCallback(async () => {
    if (!data || exporting) return;
    setExporting(true); setExportError('');
    try {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 14;
      const purple: [number, number, number] = [92, 95, 193];
      const ink: [number, number, number] = [31, 36, 51];
      const muted: [number, number, number] = [105, 112, 130];
      const fmt = (value: number) => number.format(value);
      const money = (value: number) => `INR ${number.format(Math.round(value))}`;
      const period = `${new Date(data.period.from).toLocaleDateString('en-IN', { dateStyle: 'medium', timeZone: 'UTC' })} - ${new Date(data.period.to).toLocaleDateString('en-IN', { dateStyle: 'medium', timeZone: 'UTC' })}`;
      const heading = (title: string, subtitle: string, y: number) => {
        pdf.setTextColor(...purple); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(19); pdf.text(title, margin, y);
        pdf.setTextColor(...muted); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.text(subtitle, margin, y + 6);
        pdf.setDrawColor(226, 229, 238); pdf.line(margin, y + 10, pageWidth - margin, y + 10);
      };
      const lineChart = (title: string, points: Array<{ label: string; values: Array<{ name: string; value: number; color: [number, number, number] }> }>, y: number) => {
        pdf.setTextColor(...ink); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12); pdf.text(title, margin, y);
        const chartX = margin + 12, chartY = y + 9, chartWidth = pageWidth - margin * 2 - 16, chartHeight = 43;
        const max = Math.max(1, ...points.flatMap((point) => point.values.map((item) => item.value)));
        pdf.setDrawColor(225, 228, 236); pdf.setLineWidth(.25);
        for (let tick = 0; tick < 4; tick++) {
          const lineY = chartY + chartHeight * tick / 3;
          pdf.line(chartX, lineY, chartX + chartWidth, lineY);
        }
        const series = points[0]?.values.map((item, index) => ({ name: item.name, color: item.color, values: points.map((point) => point.values[index]?.value ?? 0) })) ?? [];
        series.forEach((item) => {
          pdf.setDrawColor(...item.color); pdf.setLineWidth(.7);
          item.values.forEach((value, index) => {
            const x = chartX + (points.length <= 1 ? chartWidth / 2 : chartWidth * index / (points.length - 1));
            const pointY = chartY + chartHeight - chartHeight * value / max;
            if (index) {
              const previousX = chartX + chartWidth * (index - 1) / (points.length - 1);
              const previousY = chartY + chartHeight - chartHeight * item.values[index - 1] / max;
              pdf.line(previousX, previousY, x, pointY);
            }
          });
        });
        const labelEvery = Math.max(1, Math.ceil(points.length / 6));
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(...muted);
        points.forEach((point, index) => {
          if (index % labelEvery !== 0 && index !== points.length - 1) return;
          const x = chartX + (points.length <= 1 ? chartWidth / 2 : chartWidth * index / (points.length - 1));
          pdf.text(point.label, x, chartY + chartHeight + 5, { align: 'center' });
        });
        let legendX = margin;
        const legendY = chartY + chartHeight + 13;
        series.forEach((item) => {
          pdf.setFillColor(...item.color); pdf.circle(legendX + 1, legendY - 1, 1, 'F');
          pdf.setTextColor(...muted); pdf.text(item.name, legendX + 4, legendY);
          legendX += pdf.getTextWidth(item.name) + 12;
        });
      };
      heading('Brandly platform analytics', `${period}  |  Generated ${new Date().toLocaleString('en-IN')}`, 19);
      const cards = [
        ['Marketplace accounts', fmt(data.summary.totalUsers), `${fmt(data.summary.activeUsers)} active`],
        ['New accounts', fmt(data.summary.newUsers), `${fmt(data.summary.previousNewUsers)} previous period`],
        ['Campaigns created', fmt(data.summary.newCampaigns), `${fmt(data.summary.previousCampaigns)} previous period`],
        ['Applications', fmt(data.summary.applications), `${fmt(data.summary.acceptedApplications)} currently accepted`],
        ['Completed collaborations', fmt(data.summary.completedApplications), 'Completed in period'],
        ['Paid campaign value', money(data.summary.paidAmount), `${fmt(data.summary.paidCount)} recorded payments`],
        ['Tasks created / completed', `${fmt(data.summary.tasks)} / ${fmt(data.summary.completedTasks)}`, 'In selected period'],
        ['Chat messages', fmt(data.summary.chatMessages), 'Marketplace and support'],
        ['Active push devices', fmt(data.summary.registeredDevices), `${fmt(data.summary.notifications)} notifications`],
        ['Avg. profile completion', `${data.summary.averageProfileCompletion}%`, 'Current profile records'],
      ];
      const columns = 2, gap = 4, cardWidth = (pageWidth - margin * 2 - gap) / columns, cardHeight = 21;
      cards.forEach(([label, value, note], index) => {
        const x = margin + (index % columns) * (cardWidth + gap), y = 35 + Math.floor(index / columns) * (cardHeight + gap);
        pdf.setFillColor(248, 249, 253); pdf.setDrawColor(231, 233, 241); pdf.roundedRect(x, y, cardWidth, cardHeight, 2, 2, 'FD');
        pdf.setTextColor(...muted); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.text(label, x + 4, y + 6);
        pdf.setTextColor(...ink); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12); pdf.text(value, x + 4, y + 12.5);
        pdf.setTextColor(...muted); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.text(note, x + 4, y + 17);
      });
      const activityPoints = data.trends.users.map((point, index) => ({ label: dateLabel(point.date, data.period.bucket === 'month'), values: [
        { name: 'Accounts', value: point.value, color: purple as [number, number, number] },
        { name: 'Campaigns', value: data.trends.campaigns[index]?.value ?? 0, color: [220, 139, 57] as [number, number, number] },
        { name: 'Applications', value: data.trends.applications[index]?.value ?? 0, color: [53, 155, 119] as [number, number, number] },
      ] }));
      lineChart('Marketplace activity', activityPoints, 168);
      pdf.addPage();
      heading('Payments and marketplace breakdowns', period, 19);
      const paymentPoints = data.trends.payments.map((point) => ({ label: dateLabel(point.date, data.period.bucket === 'month'), values: [{ name: 'Paid campaign value (INR)', value: point.value, color: purple as [number, number, number] }] }));
      lineChart('Recorded paid campaign value', paymentPoints, 38);
      const breakdown = (title: string, rows: Array<{ label: string; value: number }>, x: number, y: number, width: number) => {
        pdf.setTextColor(...ink); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); pdf.text(title, x, y);
        const max = Math.max(1, ...rows.map((row) => row.value));
        rows.slice(0, 8).forEach((row, index) => {
          const rowY = y + 8 + index * 13;
          pdf.setTextColor(...muted); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8);
          pdf.text(row.label.replaceAll('_', ' ').toLowerCase().slice(0, 30), x, rowY);
          pdf.setTextColor(...ink); pdf.setFont('helvetica', 'bold'); pdf.text(fmt(row.value), x + width, rowY, { align: 'right' });
          pdf.setFillColor(239, 240, 247); pdf.roundedRect(x, rowY + 2, width, 2, 1, 1, 'F');
          pdf.setFillColor(...purple); pdf.roundedRect(x, rowY + 2, Math.max(2, width * row.value / max), 2, 1, 1, 'F');
        });
        if (!rows.length) { pdf.setTextColor(...muted); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.text('No records for this period.', x, y + 9); }
      };
      breakdown('Campaign status', data.breakdowns.campaigns, margin, 119, 78);
      breakdown('Application outcomes', data.breakdowns.applications, margin + 88, 119, 78);
      pdf.setTextColor(...muted); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7);
      pdf.text('Values are derived from saved database records. Active account/device totals reflect current status.', margin, 282);
      pdf.addPage();
      heading('Campaign categories', period, 19);
      breakdown('Most popular categories', data.breakdowns.categories, margin, 38, pageWidth - margin * 2);
      pdf.save(`brandly-analytics-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (reason) {
      setExportError(reason instanceof Error ? reason.message : 'PDF export failed.');
    } finally {
      setExporting(false);
    }
  }, [data, exporting]);

  const trend = useMemo(() => {
    if (!data) return [];
    return data.trends.users.map((point, index) => ({ label: dateLabel(point.date, data.period.bucket === 'month'), values: [
      { name: 'New accounts', value: point.value, tone: 'toneBlue' },
      { name: 'Campaigns', value: data.trends.campaigns[index]?.value ?? 0, tone: 'toneOrange' },
      { name: 'Applications', value: data.trends.applications[index]?.value ?? 0, tone: 'toneGreen' },
    ] }));
  }, [data]);
  const paymentTrend = useMemo(() => data?.trends.payments.map((point) => ({ label: dateLabel(point.date, data.period.bucket === 'month'), values: [{ name: 'Paid amount', value: point.value, tone: 'toneBlue' }] })) ?? [], [data]);
  const activePeriod = data ? `${new Date(data.period.from).toLocaleDateString('en-IN', { dateStyle: 'medium', timeZone: 'UTC' })} – ${new Date(data.period.to).toLocaleDateString('en-IN', { dateStyle: 'medium', timeZone: 'UTC' })}` : '';
  const previousChange = (value: number, previous: number) => value - previous;

  return <main className={styles.page}>
    <header className={styles.header}>
      <div><p className={styles.eyebrow}><Activity size={14} /> Platform insights</p><h1>Analytics</h1><p>Database-backed marketplace activity and business performance.</p>{activePeriod && <small className={styles.periodText}><CalendarDays size={13} />{activePeriod} · {data?.period.bucket === 'month' ? 'Monthly' : 'Daily'} reporting</small>}</div>
      <div className={styles.actions}><button className={styles.secondaryButton} type="button" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading} aria-label="Refresh analytics"><RefreshCw size={15} className={loading ? styles.spin : ''} />Refresh</button><button className={styles.primaryButton} type="button" onClick={reportPdf} disabled={!data || exporting}><Download size={15} />{exporting ? 'Preparing PDF' : 'Download PDF'}</button></div>
    </header>
    <div className={`${styles.controls} analyticsControls`}><label><CalendarDays size={15} /><span>Reporting period</span><select aria-label="Reporting period" value={days} onChange={(event) => setDays(Number(event.target.value) as Period)}>{periodOptions.map((option) => <option key={option.days} value={option.days}>{option.label}</option>)}</select></label><span className={styles.sourceNote}><Check size={14} />Live aggregates · no sample data</span></div>
    {error ? <div className={styles.error} role="alert"><Activity size={18} /><div><strong>Analytics unavailable</strong><span>{error}</span></div><button type="button" onClick={() => setRefreshKey((value) => value + 1)}>Retry</button></div> : loading && !data ? <div className={styles.loading}><LoaderCircle size={20} className={styles.spin} />Loading analytics from the database…</div> : data ? <>
      <section className={styles.metrics} aria-label="Key performance indicators">
        <MetricCard icon={Users} label="Marketplace accounts" value={number.format(data.summary.totalUsers)} note={`${number.format(data.summary.activeUsers)} active · ${number.format(data.summary.brands)} brands · ${number.format(data.summary.creators)} creators`} />
        <MetricCard icon={ArrowUpRight} label="New accounts" value={number.format(data.summary.newUsers)} note="Compared with previous period" change={previousChange(data.summary.newUsers, data.summary.previousNewUsers)} />
        <MetricCard icon={BriefcaseBusiness} label="Campaigns created" value={number.format(data.summary.newCampaigns)} note={`${number.format(data.summary.previousCampaigns)} in previous period`} change={previousChange(data.summary.newCampaigns, data.summary.previousCampaigns)} />
        <MetricCard icon={BarChart3} label="Applications" value={number.format(data.summary.applications)} note={`${number.format(data.summary.acceptedApplications)} currently accepted`} change={previousChange(data.summary.applications, data.summary.previousApplications)} />
        <MetricCard icon={Check} label="Completed collaborations" value={number.format(data.summary.completedApplications)} note="Marked complete in this period" />
        <MetricCard icon={Activity} label="Tasks created / completed" value={`${number.format(data.summary.tasks)} / ${number.format(data.summary.completedTasks)}`} note="During the selected period" />
        <MetricCard icon={CircleDollarSign} label="Paid campaign value" value={currency.format(data.summary.paidAmount)} note={`${number.format(data.summary.paidCount)} payments · ${currency.format(data.summary.previousPaidAmount)} in previous period`} />
        <MetricCard icon={MessageCircle} label="Chat messages" value={number.format(data.summary.chatMessages)} note="Marketplace and Brandly support chats" />
        <MetricCard icon={Smartphone} label="Active push devices" value={number.format(data.summary.registeredDevices)} note={`${number.format(data.summary.notifications)} notifications · ${data.summary.averageProfileCompletion}% avg profile completion`} />
      </section>
      <TrendChart title="Marketplace activity" points={trend} />
      <div className={styles.twoColumns}><TrendChart title="Paid campaign value" points={paymentTrend} unit="currency" /><Breakdown title="Campaign status" rows={data.breakdowns.campaigns} emptyLabel="No campaigns were created in this period." /></div>
      <div className={styles.twoColumns}><Breakdown title="Application outcomes" rows={data.breakdowns.applications} emptyLabel="No applications were submitted in this period." /><Breakdown title="Popular campaign categories" rows={data.breakdowns.categories} emptyLabel="No campaign categories in this period." /></div>
      <footer className={styles.footer}><Bell size={14} />Metrics reflect saved records within {activePeriod}. Active account and device totals reflect current database status.</footer>
    </> : null}
    {exportError && <div className={styles.error} role="alert"><Activity size={17} /><div><strong>PDF export failed</strong><span>{exportError}</span></div></div>}
  </main>;
}
