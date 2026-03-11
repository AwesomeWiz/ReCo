import classNames from "../data/class_names.json";

/**
 * Softmax: converts raw logits into probabilities that sum to 1.
 * Uses the max-subtraction trick to avoid overflow.
 */
function softmax(arr) {
    const max = Math.max(...arr);
    const exps = arr.map((v) => Math.exp(v - max));
    const sum = exps.reduce((a, b) => a + b, 0);
    return exps.map((e) => e / sum);
}

/**
 * Takes the raw output tensor from the TFLite classifier
 * and returns a structured prediction object.
 *
 * @param {Float32Array | Uint8Array | number[]} outputTensor
 * @returns {{ productName: string, confidence: number }}
 */
export function classifyOutput(outputTensor) {
    const raw = Array.from(outputTensor);

    // Determine if the output is logits (values outside 0-1) or probabilities
    const needsSoftmax = raw.some((v) => v < 0 || v > 1);
    const scores = needsSoftmax ? softmax(raw) : raw;

    // Find the index with the highest score
    let maxIndex = 0;
    let maxScore = scores[0];
    for (let i = 1; i < scores.length; i++) {
        if (scores[i] > maxScore) {
            maxScore = scores[i];
            maxIndex = i;
        }
    }

    // class_names.json is a 0-indexed array
    const productName =
        classNames[maxIndex] || `Unknown (class ${maxIndex})`;

    const confidence = isNaN(maxScore) ? 0 : Math.min(Math.max(maxScore, 0), 1);

    return { productName, confidence };
}
