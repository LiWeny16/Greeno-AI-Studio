export function barToStartBeat(bar, beatsPerBar = 4) {
    assertPositiveInteger(bar, "bar");
    assertPositiveInteger(beatsPerBar, "beatsPerBar");
    return (bar - 1) * beatsPerBar;
}
export function beatToBar(beat, beatsPerBar = 4) {
    if (!Number.isFinite(beat) || beat < 0) {
        throw new Error("beat must be a nonnegative finite number");
    }
    assertPositiveInteger(beatsPerBar, "beatsPerBar");
    return Math.floor(beat / beatsPerBar) + 1;
}
export function barRangeToBeatRange([startBar, endBar], beatsPerBar = 4) {
    assertPositiveInteger(beatsPerBar, "beatsPerBar");
    return [barToStartBeat(startBar, beatsPerBar), endBar * beatsPerBar];
}
export function barRangeLength([startBar, endBar]) {
    return endBar - startBar + 1;
}
function assertPositiveInteger(value, label) {
    if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`${label} must be a positive integer`);
    }
}
