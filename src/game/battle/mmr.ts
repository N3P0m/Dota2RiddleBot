export function calculateMmrDelta(
  winnerMmr: number,
  loserMmr: number,
  kFactor = 25,
): { winnerDelta: number; loserDelta: number } {
  const expectedWinner =
    1 / (1 + Math.pow(10, (loserMmr - winnerMmr) / 400));
  const expectedLoser = 1 - expectedWinner;

  const winnerDelta = Math.round(kFactor * (1 - expectedWinner));
  const loserDelta = Math.round(kFactor * (0 - expectedLoser));

  return { winnerDelta, loserDelta };
}
