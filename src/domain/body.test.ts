import { describe, expect, it } from 'vitest'
import {
  circumferencesDue,
  paceAlert,
  paceOf,
  waistAverage,
  waistSummary,
  weekChange,
  weeklyAverages,
  weekStart,
} from './body'
import { addDays } from './dates'

// Weighings for the week that starts on `monday`, one per day from Monday on.
const week = (monday: string, kgs: number[]) =>
  kgs.map((kg, i) => ({ date: addDays(monday, i), kg }))

describe('weekStart', () => {
  it.each([
    ['2027-02-01', '2027-02-01', 'Monday is its own start'],
    ['2027-02-07', '2027-02-01', 'Sunday belongs to the week that started on Monday'],
    ['2027-02-08', '2027-02-08', 'the next Monday starts another one'],
    ['2026-11-14', '2026-11-09', 'before the bulk too'],
  ])('%s → %s (%s)', (date, start) => {
    expect(weekStart(date)).toBe(start)
  })
})

describe('weekly weight', () => {
  it('1. averages the week and counts the weighings', () => {
    expect(weeklyAverages(week('2027-02-01', [74.8, 75.0, 75.2, 75.0]))).toEqual([
      { start: '2027-02-01', average: 75, count: 4 },
    ])
  })

  it('5. Sunday and the next Monday fall in different weeks', () => {
    const w = weeklyAverages([
      { date: '2027-02-07', kg: 75 },
      { date: '2027-02-08', kg: 76 },
    ])
    expect(w.map((x) => x.start)).toEqual(['2027-02-01', '2027-02-08'])
  })

  it.each<[string, number[], number[], number | null]>([
    ['3. both weeks with enough weighings', [74.8, 74.8, 74.8, 74.8, 74.8], [75, 75, 75, 75], 0.2],
    ['2/4. the previous one has only 2 weighings', [74.8, 74.8], [75, 75, 75, 75], null],
    ['the current one has only 2 weighings', [74.8, 74.8, 74.8], [75, 75], null],
    ['going down is negative', [75, 75, 75], [74.9, 74.9, 74.9], -0.1],
  ])('%s', (_name, previous, current, expected) => {
    const weeks = weeklyAverages([...week('2027-01-25', previous), ...week('2027-02-01', current)])
    expect(weekChange(weeks, '2027-02-01')).toBe(expected)
  })

  it('no previous week: no change', () => {
    expect(weekChange(weeklyAverages(week('2027-02-01', [75, 75, 75])), '2027-02-01')).toBeNull()
  })
})

describe('pace alert', () => {
  // Five Mondays in a row; the averages are the week's weight (3 weighings each).
  const MONDAYS = ['2027-01-04', '2027-01-11', '2027-01-18', '2027-01-25', '2027-02-01']
  const weeks = (avgs: number[], counts: number[] = avgs.map(() => 3)) =>
    weeklyAverages(avgs.flatMap((a, i) => week(MONDAYS[i] as string, Array(counts[i]).fill(a))))

  it.each<[string, number[], number[] | undefined, string, boolean]>([
    ['7. three finished weeks above +0,4', [74, 74.5, 74.95, 75.55], undefined, '2027-02-01', true],
    ['8. one of them at +0,3', [74, 74.5, 74.8, 75.4], undefined, '2027-02-01', false],
    ['exactly +0,4 is not above', [74, 74.4, 74.8, 75.2], undefined, '2027-02-01', false],
    [
      '9. a week in the middle with 2 weighings breaks the streak',
      [74, 74.5, 74.95, 75.55],
      [3, 3, 2, 3],
      '2027-02-01',
      false,
    ],
    ['only two finished weeks above', [74, 74.1, 74.6, 75.1], undefined, '2027-02-01', false],
    [
      '10. the week in progress doesn’t count',
      [74, 74.1, 74.6, 75.1, 75.7],
      undefined,
      '2027-02-03',
      false,
    ],
    [
      'once that week finishes, it does',
      [74, 74.1, 74.6, 75.1, 75.7],
      undefined,
      '2027-02-08',
      true,
    ],
  ])('%s', (_name, avgs, counts, today, expected) => {
    expect(paceAlert(weeks(avgs, counts), today)).toBe(expected)
  })
})

describe('waist', () => {
  it('the average of the three, to one decimal', () => {
    expect(waistAverage([81.3, 81.5, 81.4])).toBe(81.4)
    expect(waistAverage([81.3, 81.4, 81.4])).toBe(81.4)
  })

  it('against the previous week’s last one and against the first one ever', () => {
    const s = waistSummary([
      { date: '2027-01-03', measurements: [80.4, 80.4, 80.4] },
      { date: '2027-01-26', measurements: [81.0, 81.0, 81.0] },
      { date: '2027-01-31', measurements: [81.4, 81.4, 81.4] },
      { date: '2027-02-07', measurements: [81.3, 81.5, 81.4] },
    ])
    expect(s).toEqual({ date: '2027-02-07', average: 81.4, vsPreviousWeek: 0, sinceStart: 1 })
  })

  it('without a measurement the previous week, there is no weekly comparison', () => {
    const s = waistSummary([
      { date: '2027-01-03', measurements: [80, 80, 80] },
      { date: '2027-02-07', measurements: [81, 81, 81] },
    ])
    expect(s).toMatchObject({ vsPreviousWeek: null, sinceStart: 1 })
  })

  it('the first measurement has nothing to compare with', () => {
    expect(waistSummary([{ date: '2027-02-07', measurements: [81, 81, 81] }])).toMatchObject({
      vsPreviousWeek: null,
      sinceStart: null,
    })
    expect(waistSummary([])).toBeNull()
  })
})

describe('circumferences', () => {
  it.each<[string | null, boolean]>([
    [null, true],
    ['2027-01-06', false],
    ['2027-01-05', true],
    ['2026-12-01', true],
  ])('last %s, today 2027-02-04 → due %s', (last, due) => {
    expect(circumferencesDue(last, '2027-02-04')).toBe(due)
  })
})

describe('pace of a weekly change', () => {
  it.each<[number, string]>([
    [-0.1, 'down'],
    [0, 'on-track'],
    [0.25, 'on-track'],
    [0.4, 'on-track'],
    [0.42, 'too-fast'],
  ])('%s → %s', (change, pace) => {
    expect(paceOf(change)).toBe(pace)
  })
})
