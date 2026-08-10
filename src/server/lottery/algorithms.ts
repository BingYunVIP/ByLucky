import type {
  LotteryParticipant,
  LotteryPrizeItem,
  LotterySelection,
  RandomSource,
} from "./types";

function stableParticipants(participants: LotteryParticipant[]) {
  return [...participants].sort((left, right) => left.id.localeCompare(right.id));
}

function noCandidate(prizeItemId: string): LotterySelection {
  return {
    prizeItemId,
    participant: null,
    unawardedReason: "CANDIDATE_SHORTAGE",
  };
}

export function drawByFaceValuePriority(
  participants: LotteryParticipant[],
  prizeItems: LotteryPrizeItem[],
  random: RandomSource,
): LotterySelection[] {
  let eligible = stableParticipants(participants);

  return prizeItems.map((prizeItem) => {
    if (eligible.length === 0) return noCandidate(prizeItem.id);

    const highestValue = Math.max(...eligible.map((participant) => participant.totalFaceValue));
    const topGroup = eligible.filter(
      (participant) => participant.totalFaceValue === highestValue,
    );
    const winner = topGroup[random.int(0, topGroup.length)];
    eligible = eligible.filter((participant) => participant.id !== winner.id);

    return { prizeItemId: prizeItem.id, participant: winner, unawardedReason: null };
  });
}

export function drawByCodeEqual(
  participants: LotteryParticipant[],
  prizeItems: LotteryPrizeItem[],
  random: RandomSource,
): LotterySelection[] {
  let eligible = stableParticipants(participants);

  return prizeItems.map((prizeItem) => {
    if (eligible.length === 0) return noCandidate(prizeItem.id);

    const totalTickets = eligible.reduce(
      (total, participant) => total + participant.codeCount,
      0,
    );
    if (totalTickets <= 0) return noCandidate(prizeItem.id);

    const ticket = random.int(0, totalTickets);
    let upperBound = 0;
    const winner = eligible.find((participant) => {
      upperBound += participant.codeCount;
      return ticket < upperBound;
    });
    if (!winner) throw new Error("Lottery ticket selection failed");

    eligible = eligible.filter((participant) => participant.id !== winner.id);
    return { prizeItemId: prizeItem.id, participant: winner, unawardedReason: null };
  });
}
