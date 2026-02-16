export class Score {
  constructor(public readonly value: number) {
    if (value < 0 || value > 100) {
      throw new RangeError(`Score must be 0-100, got ${value}`);
    }
  }

  get letterGrade(): string {
    if (this.value >= 90) return "A";
    if (this.value >= 80) return "B";
    if (this.value >= 70) return "C";
    if (this.value >= 60) return "D";
    return "F";
  }

  get isPassingGrade(): boolean {
    return this.value >= 60;
  }
}
