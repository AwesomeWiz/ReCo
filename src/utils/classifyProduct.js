import labelMapping from "../data/labelMapping.json";

/**
 * Takes the raw Float32Array output from the TFLite classifier
 * and returns a structured prediction object.
 *
 * @param {Float32Array | number[]} outputTensor - Raw scores from model output
 * @returns {{ productName: string, confidence: number }}
 */
export function classifyOutput(outputTensor) {
    const scores = Array.from(outputTensor);

    // Find the index with the highest score
    let maxIndex = 0;
    let maxScore = scores[0];
    for (let i = 1; i < scores.length; i++) {
        if (scores[i] > maxScore) {
            maxScore = scores[i];
            maxIndex = i;
        }
    }

    // labelMapping keys are 1-indexed strings ("1" through "59")
    // Model output index 0 → label key "1", index 1 → label key "2", etc.
    const labelKey = String(maxIndex + 1);
    const productName =
        labelMapping.product_names[labelKey] || `Unknown (class ${maxIndex + 1})`;

    // Confidence: if model outputs raw logits, apply softmax; if already probabilities, use directly
    const confidence = isNaN(maxScore) ? 0 : Math.min(Math.max(maxScore, 0), 1);

    return { productName, confidence };
}
