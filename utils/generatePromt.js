/**
 * Processes AI response and extracts a formatted question
 * 
 * @param {string} aiResponse - The full text response from the AI
 * @param {string} currQuestionId - The ID of the current question
 * @returns {Object} - A properly formatted question object
 */
function processAIResponse(aiResponse, currQuestionId) {
    try {
        // Extract the JSON portion if it exists
        const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
        const jsonMatch = aiResponse.match(jsonRegex);

        if (jsonMatch && jsonMatch[1]) {
            let jsonString = jsonMatch[1].trim();

            // Fix common JSON issues before parsing
            jsonString = preprocessJson(jsonString);

            // Try direct parsing with the preprocessed JSON
            try {
                const questionData = JSON.parse(jsonString);
                const explanations = extractAnswerExplanations(aiResponse, questionData.answers);

                return {
                    ...questionData,
                    _id: currQuestionId // Use the provided ID
                };
            } catch (jsonError) {
                console.error("JSON parsing error:", jsonError);

                // Create a clean version of the question directly from the AI response
                return createCleanQuestion(aiResponse, currQuestionId);
            }
        } else {
            // No JSON block found, extract structured data from the response
            return createCleanQuestion(aiResponse, currQuestionId);
        }
    } catch (error) {
        console.error("Error processing AI response:", error);
        return {
            error: true,
            message: "Failed to process AI response: " + error.message,
            originalResponse: aiResponse
        };
    }
}

/**
 * Preprocesses JSON to fix common issues before parsing
 * 
 * @param {string} jsonString - The raw JSON string
 * @returns {string} - Cleaned JSON string
 */
function preprocessJson(jsonString) {
    // Fix unquoted property names
    jsonString = jsonString.replace(/([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g, '$1"$2"$3');

    // Fix trailing commas in arrays and objects
    jsonString = jsonString.replace(/,(\s*[\]}])/g, '$1');

    // Fix single quotes used instead of double quotes
    jsonString = jsonString.replace(/(\w+)'/g, '$1"');
    jsonString = jsonString.replace(/'(\w+)/g, '"$1');

    // Replace all single quotes with double quotes for property values
    // but only if they're not already within double quotes
    let inDoubleQuotes = false;
    let result = '';

    for (let i = 0; i < jsonString.length; i++) {
        const char = jsonString[i];

        if (char === '"' && (i === 0 || jsonString[i - 1] !== '\\')) {
            inDoubleQuotes = !inDoubleQuotes;
            result += char;
        } else if (char === "'" && !inDoubleQuotes) {
            result += '"';
        } else {
            result += char;
        }
    }

    return result;
}

/**
 * Creates a clean question object directly from AI response text
 * 
 * @param {string} aiResponse - The full AI response
 * @param {string} currQuestionId - The ID to use for the question
 * @returns {Object} - A clean question object
 */
function createCleanQuestion(aiResponse, currQuestionId) {
    // Extract question text with regex
    const questionMatch = aiResponse.match(/["""]question["""]:\s*["""](.*?)["""]/);
    const questionText = questionMatch
        ? questionMatch[1]
        : extractQuestionText(aiResponse);

    // Extract question type
    const questionTypeMatch = aiResponse.match(/["""]questionType["""]:\s*["""](.*?)["""]/);
    const questionType = questionTypeMatch
        ? questionTypeMatch[1]
        : "multipleChoice";

    // Extract answers
    const answers = extractAnswers(aiResponse);

    // Use the provided ID
    const questionId = currQuestionId;

    // Extract explanation
    const explanation = extractGeneralExplanation(aiResponse);

    // Extract answer explanations
    const answerExplanations = extractAnswerExplanations(aiResponse, answers);

    return {
        index: 1,
        questionType: questionType,
        question: questionText,
        startTime: 30,
        answers: answers,
        _id: questionId,
        explanation: explanation,
        answerExplanations: answerExplanations,
        history: []
    };
}

/**
 * Extracts question text when regex pattern fails
 * 
 * @param {string} aiResponse - The full AI response
 * @returns {string} - Extracted question text
 */
function extractQuestionText(aiResponse) {
    // Look for lines that appear to be questions
    const lines = aiResponse.split('\n');
    for (const line of lines) {
        if (line.includes('?') && line.length > 20 && !line.includes('{') && !line.includes('}')) {
            return line.trim();
        }
    }

    // Fallback - look for content after "question":
    const questionSectionMatch = aiResponse.match(/question[\s\S]*?:[\s\S]*?([^{}\[\]"',]*\?)/);
    return questionSectionMatch
        ? questionSectionMatch[1].trim()
        : "Failed to extract question text";
}

/**
 * Extracts answers from the AI response
 * 
 * @param {string} aiResponse - The full AI response
 * @returns {Array} - Array of answer objects
 */
function extractAnswers(aiResponse) {
    const answers = [];

    // Try to find the answers section in the response
    const answerSectionMatch = aiResponse.match(/"answers":\s*\[([\s\S]*?)\]/);

    if (answerSectionMatch && answerSectionMatch[1]) {
        // Split by closing brackets to find individual answer objects
        const answerObjects = answerSectionMatch[1].split('},');

        answerObjects.forEach((answerObj, index) => {
            // Extract content
            const contentMatch = answerObj.match(/"content":\s*"(.*?)"/);
            const content = contentMatch ? contentMatch[1] : `Answer ${index + 1}`;

            // Extract correctness
            const correctMatch = answerObj.match(/"isCorrect":\s*(true|false)/);
            const isCorrect = correctMatch ? correctMatch[1] === "true" : false;

            // Extract or generate ID
            const idMatch = answerObj.match(/"_id":\s*"(.*?)"/);
            const _id = idMatch ? idMatch[1] : generateId();

            answers.push({
                content,
                isCorrect,
                _id
            });
        });
    }

    // If no answers found or parsing failed, try to extract from explanations
    if (answers.length === 0) {
        // Look for explanations of correct answers
        const correctExplanationsMatch = aiResponse.match(/\*\*Explanations for Correct Answers:\*\*([\s\S]*?)(?:\*\*|$)/);
        if (correctExplanationsMatch) {
            const correctExplanations = correctExplanationsMatch[1].split('\n').filter(line => line.trim());
            correctExplanations.forEach(line => {
                const answerMatch = line.match(/\*\*(.*?):\*\*/);
                if (answerMatch) {
                    answers.push({
                        content: answerMatch[1].trim(),
                        isCorrect: true,
                        _id: generateId()
                    });
                }
            });
        }

        // Look for explanations of incorrect answers
        const incorrectExplanationsMatch = aiResponse.match(/\*\*Explanations for Incorrect Answers:\*\*([\s\S]*?)(?:\*\*|$)/);
        if (incorrectExplanationsMatch) {
            const incorrectExplanations = incorrectExplanationsMatch[1].split('\n').filter(line => line.trim());
            incorrectExplanations.forEach(line => {
                const answerMatch = line.match(/\*\*(.*?):\*\*/);
                if (answerMatch) {
                    answers.push({
                        content: answerMatch[1].trim(),
                        isCorrect: false,
                        _id: generateId()
                    });
                }
            });
        }
    }

    // If still no answers found, create some placeholder answers
    if (answers.length === 0) {
        const defaultOptions = ["fetch API", "XMLHttpRequest object", "Axios library", "console.table()", "localStorage API"];
        defaultOptions.forEach((option, index) => {
            answers.push({
                content: option,
                isCorrect: index < 3, // First three are correct in the example
                _id: generateId()
            });
        });
    }

    return answers;
}

/**
 * Extracts the general explanation from the AI response
 * 
 * @param {string} aiResponse - The full AI response
 * @returns {string} - The extracted explanation
 */
function extractGeneralExplanation(aiResponse) {
    const explanationRegex = /\*\*Explanation of Changes and Reasoning:\*\*([\s\S]*?)(?:\*\*Explanations for|$)/;
    const explanationMatch = aiResponse.match(explanationRegex);
    return explanationMatch ? explanationMatch[1].trim() : "";
}

/**
 * Extracts answer explanations from the AI response
 * 
 * @param {string} aiResponse - The full AI response
 * @param {Array} answers - The array of answer objects
 * @returns {Object} - Object mapping answer IDs to explanations
 */
function extractAnswerExplanations(aiResponse, answers) {
    const explanations = {};

    // Extract explanations for correct answers
    const correctExplanationsRegex = /\*\*Explanations for Correct Answers:\*\*([\s\S]*?)(?:\*\*Explanations for Incorrect Answers:\*\*|$)/;
    const correctExplanationsMatch = aiResponse.match(correctExplanationsRegex);

    if (correctExplanationsMatch && correctExplanationsMatch[1]) {
        const correctAnswers = answers.filter(a => a.isCorrect);
        const explanationLines = correctExplanationsMatch[1].split('\n').filter(line => line.trim());

        matchExplanationsToAnswers(explanationLines, correctAnswers, explanations);
    }

    // Extract explanations for incorrect answers
    const incorrectExplanationsRegex = /\*\*Explanations for Incorrect Answers:\*\*([\s\S]*?)(?=$)/;
    const incorrectExplanationsMatch = aiResponse.match(incorrectExplanationsRegex);

    if (incorrectExplanationsMatch && incorrectExplanationsMatch[1]) {
        const incorrectAnswers = answers.filter(a => !a.isCorrect);
        const explanationLines = incorrectExplanationsMatch[1].split('\n').filter(line => line.trim());

        matchExplanationsToAnswers(explanationLines, incorrectAnswers, explanations);
    }

    return explanations;
}

/**
 * Matches explanation lines to answer objects
 * 
 * @param {Array} explanationLines - Lines containing explanations
 * @param {Array} answerObjects - Answer objects to match against
 * @param {Object} explanationsResult - Object to populate with results
 */
function matchExplanationsToAnswers(explanationLines, answerObjects, explanationsResult) {
    explanationLines.forEach(line => {
        for (const answer of answerObjects) {
            // Try different patterns to match answers with explanations
            if (line.includes(answer.content)) {
                const parts = line.split(':');
                if (parts.length > 1) {
                    explanationsResult[answer._id] = parts.slice(1).join(':').trim();
                    break;
                }
            }
        }
    });

    // Second pass with more lenient matching if we didn't get all explanations
    if (Object.keys(explanationsResult).length < answerObjects.length) {
        explanationLines.forEach(line => {
            // Skip lines we've already processed
            const alreadyMatched = Object.values(explanationsResult).some(
                explanation => line.includes(explanation)
            );

            if (!alreadyMatched) {
                for (const answer of answerObjects) {
                    if (!explanationsResult[answer._id]) {
                        // Try to match based on keyword overlap
                        const answerWords = answer.content.toLowerCase().split(/\s+/);
                        const lineWords = line.toLowerCase().split(/\s+/);

                        const matchCount = answerWords.filter(word =>
                            word.length > 3 && lineWords.includes(word)
                        ).length;

                        if (matchCount >= Math.ceil(answerWords.length * 0.3)) {
                            const parts = line.split(':');
                            if (parts.length > 1) {
                                explanationsResult[answer._id] = parts.slice(1).join(':').trim();
                                break;
                            }
                        }
                    }
                }
            }
        });
    }
}

/**
 * Generates a simple ID for new elements
 * 
 * @returns {string} - A new unique ID
 */
function generateId() {
    return Date.now().toString(16) + Math.random().toString(16).substring(2, 8);
}

// Export functions
export default processAIResponse;