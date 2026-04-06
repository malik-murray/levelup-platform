/**
 * Central copy for Trends — RPG / run-board tone. UI imports from here.
 */

export type QuestTrend = 'improving' | 'declining' | 'stable';

export const trendsHero = {
    pageTitle: 'Trends',
    tagline:
        'Your run in order: where you stand, what the coach sees, what to do next — then patterns and deep stats when you want them.',
    loading: 'Loading your run…',
} as const;

export const trendsStory = {
    stepStatus: 'Status',
    stepInsight: 'Insight',
    stepAction: 'Action',
    stepCause: 'Patterns',
    stepDeep: 'Deep dive',
    statusTitle: 'Your run right now',
    statusSub: 'How you’re showing up in this season and lane — before you change anything else.',
    calibrationTitle: 'Calibrate this read',
    calibrationSub: 'Season length and lane change every chart and quest below — set them once, then read the story.',
    insightTitle: 'Coach read',
    insightSub: 'What’s leveling up, what’s slipping, and where to look next.',
    actionTitle: 'Your move this week',
    actionSub: 'One mission from your data — small, clear, and trackable.',
    signalTitle: 'Signal board',
    signalSub: 'Quick counts for this filtered window — green vs red at a glance before the main curve.',
    spineTitle: 'Your XP spine',
    spineSub: (days: number) =>
        `Core meter, habit XP, priorities, and quest clears across your last ${days} days — the main arc of the season.`,
    patternTitle: 'When & where you run hot',
    patternSub: 'Rhythm (time of day) and lanes (body / mind / spirit) — the “why” behind the curve.',
    deepDiveTitle: 'More analytics',
    deepDiveSub: 'Averages by pillar and every quest card — same season and lane as above.',
} as const;

export const trendsLayout = {
    primaryChartTitle: 'Your XP spine',
    primaryChartSubtitle: (days: number) =>
        `Core meter, habit XP, priority lane, and quest clears — daily % from dashboard saves over the last ${days} days.`,
    moreAnalyticsToggleShow: 'Open deep dive',
    moreAnalyticsToggleHide: 'Close deep dive',
    moreAnalyticsHint: 'Averages by pillar and every quest card — same season and lane as above.',
    groupLinesHeading: 'Rhythm & lane curves',
    groupLinesSub: 'When you show up and how body / mind / spirit lanes move — derived from habit clears.',
    groupMeansHeading: 'Average snapshot',
    groupMeansSub: 'Core stack, time-of-day rhythm, and lane balance — compressed into one season read.',
    groupQuestsHeading: 'Quest-by-quest',
    groupQuestsSub:
        'Sorted by what needs your attention first — each card has a coach note, action button, and expandable buffs / drains.',
} as const;

export function hudRangeCaption(rangeDays: number): string {
    if (rangeDays === 7) return 'Last 7 days';
    if (rangeDays === 14) return 'Last 14 days';
    if (rangeDays === 30) return 'Last 30 days';
    if (rangeDays === 60) return 'Last 60 days';
    if (rangeDays === 90) return 'Last 90 days';
    return `Last ${rangeDays} days`;
}

export const trendsHud = {
    sectionAriaLabel: 'Your run board and progression for the selected window',
    eyebrow: 'Run board',
    rankLabel: 'Rank',
    avgSuffix: 'avg',
    notEnoughDataTitle: 'Season still loading',
    notEnoughDataBody: 'Need a few scored days in this window to calculate your rank.',
    streakPower: 'Streak power',
    daysUnit: 'days',
    momentum: 'Momentum',
    bossLane: 'Boss lane',
    oneLinerNeedData: 'Log a few days in this window to unlock your run stats.',
    lanesAll: 'all lanes',
    laneNamed: (category: string) => `${category} lane`,
    oneLinerStrong: 'You’re on the board in the',
    oneLinerShoreUp: 'You’re running',
    oneLinerShoreUpSuffix: 'next.',
    momentumStableZone: 'Stable zone',
    momentumNeedLongerRun: 'Need a longer run',
    momentumGainingXp: (delta: number) => {
        const sign = delta > 0 ? '+' : '';
        return `Gaining XP ${sign}${delta}%`;
    },
    momentumLosingXp: (delta: number) => `Losing XP ${delta}%`,
    weakAreaPhysical: 'Physical',
    weakAreaMental: 'Mental',
    weakAreaSpiritual: 'Spiritual',
    weakAreaMorning: 'Morning',
    weakAreaAfternoon: 'Afternoon',
    weakAreaEvening: 'Evening',
    weakAreaNotEnough: 'Not enough data yet',
    weakAreaNoHabitsInLane: 'No habits in this lane',
    weakAreaTimeSuffix: (time: string, filter: string) => `${time} (${filter})`,
} as const;

export const trendsPulse = {
    sectionTitle: 'Performance signals',
    sectionSubtitle: 'Quick counts for this filtered window — next to your weekly quest.',
    levelingUpLabel: 'Habits leveling up',
    levelingUpAria: (n: number) =>
        `${n} ${n === 1 ? 'habit is' : 'habits are'} leveling up versus earlier in this period`,
    losingXpLabel: 'Habits losing XP',
    losingXpAria: (n: number) =>
        `${n} ${n === 1 ? 'habit is' : 'habits are'} losing XP versus earlier in this period`,
    streakPowerLabel: 'Streak power (3+ days)',
    streakPowerAria: (n: number) =>
        `${n} ${n === 1 ? 'habit has' : 'habits have'} a hot streak of three or more days`,
    inactiveLabel: 'Inactive 10+ days',
    inactiveAria: (n: number) =>
        `${n} ${n === 1 ? 'habit has' : 'habits have'} been inactive with no clears for ten days or more`,
} as const;

export const trendsFilters = {
    sectionTitle: 'Calibrate the run',
    sectionSubtitle:
        'Defaults keep the page usable on day one. Change season length or lane when you want a tighter read.',
    rangeEyebrow: 'Season length',
    categoryEyebrow: 'Lane',
    categoryHint: 'Quest list + lane charts',
    categoryAll: 'All lanes',
    categoryPhysical: 'Physical',
    categoryMental: 'Mental',
    categorySpiritual: 'Spiritual',
} as const;

export const trendsXpTrend = {
    sectionTitle: 'XP trend — how your stack moved',
    sectionSubtitle: (days: number) =>
        `Dashboard saves drive core meter, habit XP, priority lane, and quest clears. Time-of-day and lane lines come from good habits across your last ${days} days.`,
    emptyNoHabits: 'Add active habits or log a day on the dashboard to see your XP curves.',
    emptyNoScores:
        'No saved daily scores in this range yet — open deep dive for lane & rhythm lines from habit clears, or save a day on the dashboard to fill this chart.',
    chartCoreTitle: 'Core stack — daily XP',
    chartCoreSubtitle: 'Day-by-day percentages from your dashboard saves — the spine of your run.',
    chartRhythmTitle: 'Rhythm — when you show up',
    chartRhythmSubtitle:
        'Quest progress % by morning, afternoon, or evening tags. A missing day counts as a miss.',
    chartRhythmEmptyHint:
        'None of your habits have a time of day set. Edit a habit and pick morning, afternoon, or evening to power this chart.',
    chartRhythmNoData: 'No time-tagged quests in this window.',
    chartLanesTitle: 'Lanes — body, mind, spirit',
    chartLanesSubtitleAll: 'Quest progress % for good habits in each lane.',
    chartLanesSubtitleOne: (lane: string) => `${lane} habits only.`,
    chartLanesNoData: 'No lane data for this range.',
    seriesCoreMeter: 'Core meter',
    seriesHabitXp: 'Habit XP',
    seriesPriorityLane: 'Priority lane',
    seriesQuestClears: 'Quest clears',
    seriesMorning: 'Morning',
    seriesAfternoon: 'Afternoon',
    seriesEvening: 'Evening',
    seriesPhysical: 'Physical',
    seriesMental: 'Mental',
    seriesSpiritual: 'Spiritual',
    axisPercent: '%',
    tooltipAvgSeries: 'Avg %',
} as const;

export const trendsAverageZone = {
    sectionTitle: 'Mean loadout — where you land on average',
    sectionSubtitle: 'Same window as the lines, averaged — for balance checks, not noise.',
    barCoreTitle: 'Core pillars (avg)',
    barCoreEmpty: 'Appears when you save a day on the dashboard (score row).',
    barCoreNoBars: 'No averages yet.',
    barTimeTitle: 'Rhythm averages',
    barTimeHint: 'Habits with a time tag only',
    barTimeEmpty: 'Set time of day on habits to unlock.',
    barTimeEmptyRange: 'No averages for days in range.',
    barLaneTitle: 'Lane balance',
    barLaneHint: 'Good habits by lane',
    barLaneEmpty: 'No lane scores in this range.',
} as const;

export const trendsQuestCard = {
    emptyAll: 'No active quests in this season.',
    emptyFiltered: (lane: string) =>
        `No active quests in the ${lane.charAt(0).toUpperCase() + lane.slice(1)} lane for this range.`,
    trendStable: 'Stable zone',
    trendLevelingUp: (delta: number) => `+${delta}% leveling up`,
    trendLosingXp: (delta: number) => `${delta}% losing XP`,
    trendAriaStable: 'Momentum versus earlier in this period: holding steady in the stable zone',
    trendAriaUp: (delta: number) => `Momentum versus earlier in this period: leveling up about ${delta} percent`,
    trendAriaDown: (delta: number) => `Momentum versus earlier in this period: losing about ${Math.abs(delta)} percent XP`,
    statMomentum: 'Momentum',
    statMomentumHint: '% clears this window',
    statClears: 'Clears',
    statClearsHint: 'days cleared / days in season',
    statStreakPower: 'Streak power',
    statBestRun: 'Best run',
    performanceBuffs: 'Performance buffs',
    performanceDrains: 'At risk / drains',
    noBuffsYet: 'No strong buff yet — keep logging.',
    noDrains: 'No drain detected this window.',
    barAria: (pct: number) => `Quest progress ${pct} percent`,
} as const;

export const trendsQuestSignals = {
    streakPower: (n: number) => `Streak power: ${n} days`,
    levelingVsPrior: (d: number) => `Up ${d}% vs earlier in this run`,
    strongMomentum: (pct: number) => `Strong momentum: ${pct}% clear rate`,
    inactive10: 'Inactive 10+ days — at risk',
    losingVsPrior: (d: number) => `Down ${Math.abs(d)}% vs earlier in this run`,
    lowMomentum: 'Low momentum this season',
} as const;

export const trendsHabitCoach = {
    statusLevelingUp: 'Leveling up',
    statusStable: 'Stable',
    statusAtRisk: 'At risk',
    statusDeclining: 'Declining',
    statusInactive: 'Inactive',
    ctaFixThis: 'Fix This',
    ctaOptimize: 'Optimize',
    ctaLockIn: 'Lock In',
    ctaProtectStreak: 'Protect Streak',
    ctaBuildMomentum: 'Build Momentum',
    momentumBadge: 'Momentum read',
    coachNoteEyebrow: 'Coach note',
    signalsToggle: 'Buffs & drains',
    streakRiskAria: 'Streak risk signal',
    recAfterNdayRuns: (n: number, current: number, samples: number) =>
        `You’ve often snapped runs near ${n} days (${samples} similar breaks in this window). You’re at ${current} now — keep tomorrow’s bar embarrassingly small.`,
    recInactiveReturn: 'No pressure for a hero week — open the quest and use a half-clear on rough days so the board stays honest.',
    recAnchorUntagged: (slot: string) =>
        `Your clears peak in ${slot} this season — tag this quest there so it rides your strongest window.`,
    recShiftFromWeakSlot: (weak: string, strong: string) =>
        `${weak} is your softer block right now vs ${strong} — try sliding this quest toward ${strong} once and compare the graph.`,
    recHighPerformerSlip:
        'Still a strong average, but the back half is cooler than the front — add one mid-week checkpoint so the dip doesn’t compound.',
    recReduceFrequency: 'Daily pressure might be the leak — try 4× full clears per week with honest half-days between.',
    recPairPeer: (peer: string) =>
        `Pair with “${peer}” in the same lane — same trigger window, easier follow-through.`,
    recProtectLongest: (longest: number) =>
        `You’ve proven a ${longest}-day run before — protect the chain with a minimum viable clear on tired days.`,
    recStableElite: 'Elite consistency — don’t raise the bar until this feels boring; tighten one trigger instead.',
    streakRiskPattern: (typical: number, current: number) =>
        `Streak cliff watch: similar runs near ${typical} days often broke next — you’re at ${current}. Log the smallest win today.`,
    streakRiskPressure: 'Momentum is cooling while the streak is still on the board — one early clear today holds the line.',
} as const;

export const trendsRhythmLaneInsights = {
    neutralWeak: 'No strong pattern yet — keep logging and the splits will sharpen.',
    labelMorning: 'Morning',
    labelAfternoon: 'Afternoon',
    labelEvening: 'Evening',
    labelPhysical: 'Physical',
    labelMental: 'Mental',
    labelSpiritual: 'Spiritual',
    rhythmStrong: (best: string, worst: string, pct: number) =>
        `You perform about ${pct}% better in ${best} than ${worst} this window — stack more clears where you’re already winning.`,
    rhythmStrongNamed: (best: string, worst: string, pct: number, habitName: string, bestAgain: string) =>
        `You perform about ${pct}% better in ${best} than ${worst}. Try moving “${habitName}” to ${bestAgain} so it rides that window.`,
    rhythmModerate: (best: string, worst: string, gap: number) =>
        `${best} leads ${worst} by about ${gap} points — enough to care. Put priority quests in ${best} first.`,
    rhythmBalanced:
        'Morning, afternoon, and evening are neck-and-neck — pick one anchor window and repeat until it feels automatic.',
    chipMoveToBlock: (block: string) => `Move habits to ${block}`,
    laneStrongestWeakest: (top: string, weak: string, gap: number) =>
        `${top} habits are strongest this window; ${weak} trails by about ${gap} points. That’s the highest-leverage lane to buff next.`,
    laneStrongestWeakestDrags: (top: string, weak: string, drag: number) =>
        `${top} habits are carrying the chart; ${weak} sits about ${drag} points under your three-lane average — it’s the weight on the overall score.`,
    laneModerateTilt: (top: string, weak: string, gap: number) =>
        `${top} is ahead and ${weak} is softest (~${gap} pts apart). A small push in ${weak} keeps the season balanced.`,
    laneBalanced: (score: number) =>
        `Lanes look balanced (balance ~${score}/100) — stay proportional or double down on the lane that unlocks your next milestone.`,
    laneNeedMoreData: 'Log a few more days across all three lanes to compare body, mind, and spirit with confidence.',
    laneSingleSnapshot: (lane: string, avg: number) =>
        `${lane} is averaging about ${avg}% in this view — open all lanes to see which pillar leads and which needs reps.`,
    chipFocusLane: (lane: string) => `Focus ${lane} this week`,
    chipViewAllLanes: 'View all lanes',
} as const;

export const trendsWeeklyQuest = {
    sectionEyebrow: 'This Week’s Quest',
    sectionSub: 'One winnable objective built from your run — not generic grind.',
    rewardLabel: 'Reward',
    progressLabelEyebrow: 'Progress',
    titleReengage: (name: string) => `Bring “${name}” back online`,
    subReengage: (n: number) => `${n} full clears in the last 7 days`,
    reasonReengage: (name: string) =>
        `This quest has gone quiet — small wins on ${name} reopen the XP curve fast.`,
    titleProtectStreak: (name: string) => `Protect the streak on ${name}`,
    subProtectStreak: 'Log at least once every day you play this week',
    reasonProtectStreak: (name: string, streak: number) =>
        `You’re holding a ${streak}-day chain — one ugly zero wipes more than the number suggests.`,
    titleRecover: (name: string) => `Recover ${name}`,
    subRecover: '5 full clears in the next 7 days',
    subRecoverSoft: '4 strong clears before the week ends',
    reasonRecover: (name: string, drop: number) =>
        `Momentum dipped ~${drop}% vs earlier in your window — ${name} is the fastest salvage.`,
    reasonRecoverSoft: (name: string) =>
        `${name} is cooling off — a short rep window pulls it back before it hard-resets.`,
    titleLaneFocus: (lane: string) => `Fix your ${lane} lane this week`,
    subLaneFocus: (lane: string) => `Bias reps toward ${lane} quests`,
    reasonLaneGap: (lead: string, weak: string, gap: number) =>
        `${lead} is leading; ${weak} trails by ~${gap} pts on average — that gap is your leverage.`,
    titleLaneFloor: (lane: string) => `Bring ${lane} above 80%`,
    subLaneFloor: 'Lift the lane average with steady clears',
    reasonLaneFloor: (lane: string, avg: number) =>
        `${lane} is sitting near ${avg}% — a focused week breaks into elite territory.`,
    titleRhythm: (slot: string) => `Stack clears in ${slot}`,
    subRhythm: (weak: string) => `Ease pressure in ${weak} until the stronger window carries you`,
    reasonRhythm: (strong: string, weak: string, gap: number) =>
        `You run ~${gap} pts hotter in ${strong} than ${weak} — anchor hard quests in ${strong}.`,
    fallbackTitle: 'Open the board once today',
    fallbackSubtitle: (days: number) =>
        `Need a bit more runway in this ${days}-day window — start with one honest clear.`,
    fallbackReason: 'Sparse data still counts — log today so next week’s quest can target a real weak spot.',
    defaultTitle: 'Hold the line on your top quest',
    defaultSubtitle: 'One clean week keeps the graph honest',
    defaultReason: 'Nothing is flashing red — protect your strongest routine and tighten one loose screw.',
    rewardStreakXp: '+Streak XP & momentum if you close it',
    rewardMomentumBoost: '+Momentum boost on your run board',
    rewardLevelBoost: '+Level-style lift when the curve turns green again',
    rewardLaneXp: '+Lane XP when this average climbs',
    rewardHabitXpBurst: '+Habit XP burst when you cross the 80 line',
    rewardRhythmSync: '+Rhythm sync — same-window clears stack faster',
    rewardFirstWin: '+First-win bonus when the week has real data',
    rewardSteadyXp: '+Steady XP for showing up',
    progressClearsWeek: (cur: number, goal: number) => `${cur} / ${goal} full clears (last 7 days)`,
    progressWeekClears: (cur: number, goal: number) => `${cur} / ${goal} days cleared this week`,
    progressAvgToTarget: (cur: number, target: number) => `Lane avg ${cur}% → target ${target}%`,
    ctaFocusThis: 'Focus This',
    ctaStartQuest: 'Start Quest',
    ctaViewHabit: 'View Target Habit',
} as const;

export const trendsCoachPanel = {
    title: 'Your trends breakdown',
    subtitle: (days: number) =>
        `Coach read on the last ${days} days — same season length and lane as your charts.`,
    performanceSignalsEyebrow: 'Performance signals',
    fallbackTitle: 'Need a bit more runway',
    fallbackBody:
        'Complete a few more days to unlock stronger insights — aim for at least five days in the window, three days with quest check-ins, and one active habit in this lane. Charts still update; this panel levels up as the sample grows.',
} as const;

export const trendInsightsCopy = {
    categoryLane: (key: 'physical' | 'mental' | 'spiritual') =>
        key.charAt(0).toUpperCase() + key.slice(1),
    categoryStrongestTitle: (lane: string) => `${lane} is your lead lane`,
    categoryStrongestBody: (lane: string) =>
        `You’re executing hardest in ${lane} this window — lean on that momentum and borrow its structure for the other lanes.`,
    categoryWeakestTitle: (lane: string) => `${lane} needs reps`,
    categoryWeakestBody: (lane: string) =>
        `${lane} is trailing. Pick one small daily win there before you chase bigger targets elsewhere.`,
    categoriesTightTitle: 'Lanes are even',
    categoriesTightBody:
        'Physical, mental, and spiritual are within reach of each other — solid balance. Push one lane on purpose if you want a breakout season.',
    timeLabel: (key: 'morning' | 'afternoon' | 'evening') =>
        key === 'morning' ? 'Morning' : key === 'afternoon' ? 'Afternoon' : 'Evening',
    powerWindowTitle: (label: string) => `${label} is your power window`,
    powerWindowBody: (label: string) =>
        `Stack your non‑negotiables in the ${label.toLowerCase()} — that’s where your clear rate peaks right now.`,
    timeEvenTitle: 'Time blocks are even',
    timeEvenBody:
        'Morning, afternoon, and evening look similar. Lock one anchor slot anyway — consistency beats scattered effort.',
    habitLevelingTitle: (name: string) => `${name} is leveling up`,
    habitLevelingBody: (d: number) =>
        `Roughly +${d}% clears vs the first half of this range — keep the same triggers; they’re working.`,
    habitLosingTitle: (name: string) => `${name} is losing XP`,
    habitLosingBody: (d: number) =>
        `Down about ${Math.abs(d)}% vs earlier in the window. Shrink the ask for two days, then build back — don’t hero‑ball it.`,
    prioritiesAheadTitle: 'Priority lane ahead of habit XP',
    prioritiesAheadBody:
        'Your priority score is running hotter than habit XP — great focus, but convert a couple of those wins into repeatable daily reps.',
    habitsAheadTitle: 'Habit XP is carrying the board',
    habitsAheadBody:
        'Routines are beating priorities on paper — tighten one priority so your week matches what the habits already prove you can do.',
    streakTitle: (name: string, days: number) => `${name}: ${days}-day streak power`,
    streakBody:
        'That’s real consistency — protect it with a minimum viable clear on rough days so you don’t zero out.',
    longerBeforeTitle: 'You’ve posted longer runs before',
    longerBeforeBody: (days: number, name: string) =>
        `Your best stretch hit ${days} days on ${name}. Replay whatever setup made that happen.`,
    solidHitTitle: 'Solid clear rate across quests',
    solidHitBody: (pct: number) =>
        `You’re averaging about ${pct}% clears in this filter — repeatable territory. Don’t raise the bar until it feels boring.`,
    backHalfSoftTitle: 'Back half of the season is softer',
    backHalfSoftBody:
        'Clear rate tends to dip after the first few days in this window — front‑load the hardest quest, or add a mid‑week checkpoint so the slide doesn’t compound.',
    closingStrongTitle: 'You’re closing stronger',
    closingStrongBody:
        'Later days in this window outperform the start — you’re building pressure over time instead of burning out early.',
    paddingMomentumTitle: (pct: number) => `${pct}% average momentum`,
    paddingMomentumBodyHigh:
        'Hold this baseline — tighten one quest at a time instead of resetting the whole board.',
    paddingMomentumBodyLow:
        'One clean week moves the needle from here — pick the smallest daily clear and repeat.',
    paddingActiveDaysTitle: (n: number) => `${n} active days this season`,
    paddingActiveDaysBody:
        'Every logged day sharpens these charts. Missed days are data too — use them to adjust difficulty, not guilt.',
    paddingScopeTitle: (n: number) => `${n} quest${n === 1 ? '' : 's'} in this view`,
    paddingScopeBodyAll:
        'Tag time-of-day on habits so the coach can call out your strongest hours.',
    paddingScopeBodyFiltered: (lane: string) =>
        `You’re filtered to ${lane} — open “All lanes” when you want the full picture.`,
} as const;

export function questTrendBadgeDisplay(trend: QuestTrend, delta: number): string {
    if (trend === 'stable') return trendsQuestCard.trendStable;
    if (trend === 'improving') return trendsQuestCard.trendLevelingUp(delta);
    return trendsQuestCard.trendLosingXp(delta);
}

export function questTrendBadgeAria(trend: QuestTrend, delta: number): string {
    if (trend === 'stable') return trendsQuestCard.trendAriaStable;
    if (trend === 'improving') return trendsQuestCard.trendAriaUp(delta);
    return trendsQuestCard.trendAriaDown(delta);
}
