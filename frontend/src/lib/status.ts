type Tone = "zinc" | "blue" | "green" | "red" | "amber";

const toneByStatus: Record<string, Tone> = {
  draft: "zinc",
  sent: "blue",
  paid: "green",
  void: "red",
};

export function statusTone(status: string): Tone {
  return toneByStatus[status] ?? "zinc";
}
