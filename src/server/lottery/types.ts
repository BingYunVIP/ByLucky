export type LotteryParticipant = {
  id: string;
  originalEmail: string;
  canonicalEmail: string;
  codeCount: number;
  totalFaceValue: number;
};

export type LotteryPrizeItem = {
  id: string;
  prizeTierId: string;
  sequenceNo: number;
};

export type LotterySelection = {
  prizeItemId: string;
  participant: LotteryParticipant | null;
  unawardedReason: "CANDIDATE_SHORTAGE" | null;
};

export interface RandomSource {
  int(minInclusive: number, maxExclusive: number): number;
}
