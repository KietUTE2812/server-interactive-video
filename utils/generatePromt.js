import { ObjectId } from 'mongodb';

/**
 * Processes AI response and extracts a formatted question
 * 
 * @param {string} aiResponse - The full text response from the AI
 * @param {string} currQuestionId - The ID of the current question (optional)
 * @returns {Object} - A properly formatted question object
 */
function processAIResponse(aiResponse, currQuestionId = null) {


    try {
        // First try to extract and parse JSON
        const jsonResult = tryExtractAndParseJSON(aiResponse);
        if (jsonResult.success) {
            return formatQuestionData(jsonResult.data, currQuestionId);
        }

        // If JSON parsing fails, fall back to text extraction
        console.warn("JSON parsing failed, falling back to text extraction");
        return createQuestionFromText(aiResponse, currQuestionId);

    } catch (error) {
        console.error("Error processing AI response:", error);
        return createErrorResponse(error, aiResponse);
    }
}

/**
 * Attempts to extract and parse JSON from AI response
 * 
 * @param {string} aiResponse - The full AI response
 * @returns {Object} - Result object with success flag and data/error
 */
function tryExtractAndParseJSON(aiResponse) {
    try {
        // Extract JSON from various formats
        let jsonString = extractJSONString(aiResponse);
        if (!jsonString) {
            return { success: false, error: "No JSON found" };
        }

        // Clean and preprocess JSON
        jsonString = preprocessJSON(jsonString);

        // Parse JSON
        const parsedData = JSON.parse(jsonString);

        // Validate basic structure
        if (!isValidQuestionStructure(parsedData)) {
            return { success: false, error: "Invalid question structure" };
        }

        return { success: true, data: parsedData };

    } catch (error) {
        console.error("JSON extraction/parsing failed:", error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Extracts JSON string from AI response using multiple patterns
 * 
 * @param {string} aiResponse - The full AI response
 * @returns {string|null} - Extracted JSON string or null
 */
function extractJSONString(aiResponse) {
    // Remove "Processing AI response..." and "AI Response:" prefixes
    let cleaned = aiResponse.replace(/^.*?AI Response:\s*/s, '');

    // Pattern 1: Standard markdown JSON code block
    let match = cleaned.match(/```json\s*([\s\S]*?)\s*```/i);
    if (match) return match[1];

    // Pattern 2: Generic code block
    match = cleaned.match(/```\s*([\s\S]*?)\s*```/);
    if (match) {
        const content = match[1];
        // Check if it looks like JSON
        if (content.trim().startsWith('{') && content.trim().endsWith('}')) {
            return content;
        }
    }

    // Pattern 3: Find JSON object without code block
    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}');

    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        return cleaned.substring(jsonStart, jsonEnd + 1);
    }

    return null;
}

/**
 * Preprocesses JSON string to fix common issues
 * 
 * @param {string} jsonString - Raw JSON string
 * @returns {string} - Cleaned JSON string
 */
function preprocessJSON(jsonString) {
    // Remove single-line comments
    jsonString = jsonString.replace(/\/\/.*$/gm, '');

    // Remove multi-line comments
    jsonString = jsonString.replace(/\/\*[\s\S]*?\*\//g, '');

    // Fix trailing commas
    jsonString = jsonString.replace(/,(\s*[}\]])/g, '$1');

    // Fix unquoted property names (simple cases)
    jsonString = jsonString.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)(\s*:)/g, '$1"$2"$3');

    // Clean up whitespace
    jsonString = jsonString.replace(/\s+/g, ' ').trim();

    return jsonString;
}

/**
 * Validates if parsed data has basic question structure
 * 
 * @param {Object} data - Parsed JSON data
 * @returns {boolean} - True if valid structure
 */
function isValidQuestionStructure(data) {
    return (
        data &&
        typeof data === 'object' &&
        data.question &&
        Array.isArray(data.answers) &&
        data.answers.length > 0
    );
}

/**
 * Formats question data with proper ObjectIds and structure
 * 
 * @param {Object} questionData - Raw question data
 * @param {string} currQuestionId - Current question ID
 * @returns {Object} - Formatted question object
 */
function formatQuestionData(questionData, currQuestionId) {
    // Generate or use provided ObjectId
    const questionId = currQuestionId ?
        (ObjectId.isValid(currQuestionId) ? new ObjectId(currQuestionId) : new ObjectId()) :
        new ObjectId();

    // Process answers with ObjectIds
    const processedAnswers = questionData.answers.map(answer => ({
        content: answer.content || '',
        isCorrect: Boolean(answer.isCorrect),
        _id: new ObjectId()
    }));

    // Validate at least one correct answer for single-choice
    const questionType = questionData.questionType || 'single-choice';
    if (questionType === 'single-choice') {
        const correctCount = processedAnswers.filter(a => a.isCorrect).length;
        if (correctCount === 0) {
            // Default first answer as correct if none specified
            processedAnswers[0].isCorrect = true;
        } else if (correctCount > 1) {
            // Keep only first correct answer for single-choice
            let foundFirst = false;
            processedAnswers.forEach(answer => {
                if (answer.isCorrect && foundFirst) {
                    answer.isCorrect = false;
                } else if (answer.isCorrect) {
                    foundFirst = true;
                }
            });
        }
    }

    // Build formatted question object
    const formattedQuestion = {
        _id: questionId,
        questionType: questionType,
        question: questionData.question,
        startTime: questionData.startTime || Date.now(),
        answers: processedAnswers,
        history: [],
        explanation: formatExplanation(questionData.explanation),
        ...(questionData.index && { index: questionData.index })
    };

    return formattedQuestion;
}

/**
 * Formats explanation object
 * 
 * @param {Object|string} explanation - Raw explanation data
 * @returns {Object} - Formatted explanation object
 */
function formatExplanation(explanation) {
    if (!explanation) {
        return { correct: '', incorrect: {} };
    }

    if (typeof explanation === 'string') {
        return { correct: explanation, incorrect: {} };
    }

    if (typeof explanation === 'object') {
        return {
            correct: explanation.correct || '',
            incorrect: explanation.incorrect || {}
        };
    }

    return { correct: '', incorrect: {} };
}

/**
 * Creates question from text when JSON parsing fails
 * 
 * @param {string} aiResponse - The full AI response
 * @param {string} currQuestionId - Current question ID
 * @returns {Object} - Question object created from text
 */
function createQuestionFromText(aiResponse, currQuestionId) {
    const questionId = currQuestionId ?
        (ObjectId.isValid(currQuestionId) ? new ObjectId(currQuestionId) : new ObjectId()) :
        new ObjectId();

    return {
        _id: questionId,
        questionType: extractQuestionType(aiResponse),
        question: extractQuestionText(aiResponse),
        startTime: Date.now(),
        answers: extractAnswersFromText(aiResponse),
        history: [],
        explanation: {
            correct: extractGeneralExplanation(aiResponse),
            incorrect: {}
        },
        processingNote: "Created from text extraction due to JSON parsing failure"
    };
}

/**
 * Extracts question type from text
 * 
 * @param {string} aiResponse - AI response text
 * @returns {string} - Question type
 */
function extractQuestionType(aiResponse) {
    const typePatterns = [
        { pattern: /single[- ]?choice/i, type: 'single-choice' },
        { pattern: /multiple[- ]?choice/i, type: 'multiple-choice' },
        { pattern: /true[- ]?false/i, type: 'true-false' },
        { pattern: /fill[- ]?blank/i, type: 'fill-blank' }
    ];

    for (const { pattern, type } of typePatterns) {
        if (pattern.test(aiResponse)) {
            return type;
        }
    }

    return 'single-choice'; // default
}

/**
 * Extracts question text from AI response
 * 
 * @param {string} aiResponse - The full AI response
 * @returns {string} - Extracted question text
 */
function extractQuestionText(aiResponse) {
    // Pattern 1: Look for quoted question after "question" key
    let match = aiResponse.match(/["""]question["""]:\s*["""]([^"""]*)["""]/i);
    if (match) return match[1].trim();

    // Pattern 2: Look for lines ending with question mark
    const lines = aiResponse.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.endsWith('?') && trimmed.length > 10 &&
            !trimmed.includes('{') && !trimmed.includes('}')) {
            return trimmed;
        }
    }

    // Pattern 3: Look after "question:" (case insensitive)
    match = aiResponse.match(/question:\s*([^{}\n]*\?)/i);
    if (match) return match[1].trim();

    return "Unable to extract question text - manual review required";
}

/**
 * Extracts answers from text when JSON parsing fails
 * 
 * @param {string} aiResponse - AI response text
 * @returns {Array} - Array of answer objects
 */
function extractAnswersFromText(aiResponse) {
    const answers = [];

    // Try to extract from JSON-like structure first
    const optionsMatch = aiResponse.match(/"options":\s*\[([\s\S]*?)\]/);
    const correctOptionMatch = aiResponse.match(/"correct_option":\s*"([^"]*)"/);

    if (optionsMatch) {
        const optionsText = optionsMatch[1];
        // Xử lý mảng options
        const options = optionsText
            .split(',')
            .map(opt => opt.trim().replace(/^"|"$/g, '')); // Loại bỏ dấu ngoặc kép

        // Lấy correct_option
        const correctOption = correctOptionMatch ?
            correctOptionMatch[1].trim() :
            options[0]; // Mặc định lấy option đầu tiên nếu không có correct_option

        // Tạo mảng answers
        options.forEach(option => {
            answers.push({
                _id: new ObjectId(),
                content: option,
                isCorrect: option === correctOption
            });
        });
    }

    // If no answers found, try to extract from explanations
    if (answers.length === 0) {
        const explanationsMatch = aiResponse.match(/"explanations":\s*{([\s\S]*?)}/);
        if (explanationsMatch) {
            const explanationsText = explanationsMatch[1];
            const optionsMatch = explanationsText.match(/"options":\s*\[([\s\S]*?)\]/);

            if (optionsMatch) {
                const optionsText = optionsMatch[1];
                const options = optionsText
                    .split('},{')
                    .map(opt => {
                        const contentMatch = opt.match(/"content":\s*"([^"]*)"/);
                        return contentMatch ? contentMatch[1] : null;
                    })
                    .filter(Boolean);

                // Lấy correct_option từ explanations
                const correctOptionMatch = explanationsText.match(/"correct_option":\s*"([^"]*)"/);
                const correctOption = correctOptionMatch ?
                    correctOptionMatch[1].trim() :
                    options[0];

                options.forEach(option => {
                    answers.push({
                        _id: new ObjectId(),
                        content: option,
                        isCorrect: option === correctOption
                    });
                });
            }
        }
    }

    // If still no answers found, look for bullet points or numbered lists
    if (answers.length === 0) {
        const lines = aiResponse.split('\n');
        const answerLines = lines.filter(line => {
            const trimmed = line.trim();
            return (trimmed.match(/^[A-D]\)/) ||
                trimmed.match(/^[1-4]\./) ||
                trimmed.match(/^[\-\*]/)) &&
                trimmed.length > 3;
        });

        if (answerLines.length > 0) {
            answerLines.forEach((line, index) => {
                const content = line.replace(/^[A-D\)\-\*1-4\.\s]+/, '').trim();
                answers.push({
                    _id: new ObjectId(),
                    content: content,
                    isCorrect: index === 0
                });
            });
        } else {
            // Create fallback answers
            const defaultAnswers = [
                "Option A (Please review)",
                "Option B (Please review)",
                "Option C (Please review)",
                "Option D (Please review)"
            ];

            defaultAnswers.forEach((content, index) => {
                answers.push({
                    _id: new ObjectId(),
                    content: content,
                    isCorrect: index === 0
                });
            });
        }
    }

    return answers;
}

/**
 * Extracts general explanation from AI response
 * 
 * @param {string} aiResponse - The full AI response
 * @returns {string} - Extracted explanation
 */
function extractGeneralExplanation(aiResponse) {
    const patterns = [
        /explanation[^:]*:\s*([^{}\n]*)/i,
        /because\s+([^{}\n.]*)/i,
        /reason[^:]*:\s*([^{}\n]*)/i
    ];

    for (const pattern of patterns) {
        const match = aiResponse.match(pattern);
        if (match && match[1].trim().length > 10) {
            return match[1].trim();
        }
    }

    return "No explanation available";
}

/**
 * Creates error response object
 * 
 * @param {Error} error - The error that occurred
 * @param {string} aiResponse - Original AI response
 * @returns {Object} - Error response object
 */
function createErrorResponse(error, aiResponse) {
    return {
        _id: new ObjectId(),
        error: true,
        message: `Failed to process AI response: ${error.message}`,
        questionType: 'single-choice',
        question: 'Error processing question - manual review required',
        startTime: Date.now(),
        answers: [
            { _id: new ObjectId(), content: 'Error - Please review', isCorrect: true },
            { _id: new ObjectId(), content: 'Manual intervention needed', isCorrect: false }
        ],
        history: [],
        explanation: {
            correct: 'Processing error occurred',
            incorrect: {}
        },
        originalResponse: aiResponse.substring(0, 1000), // Truncate for storage
        processingError: {
            message: error.message,
            timestamp: new Date().toISOString()
        }
    };
}

/**
 * Utility function to generate MongoDB ObjectId
 * 
 * @returns {ObjectId} - New MongoDB ObjectId
 */
function generateObjectId() {
    return new ObjectId();
}

/**
 * Validates if a string is a valid ObjectId
 * 
 * @param {string} id - ID to validate
 * @returns {boolean} - True if valid ObjectId
 */
function isValidObjectId(id) {
    return ObjectId.isValid(id);
}

// Export the main function and utilities
export default processAIResponse;
export {
    generateObjectId,
    isValidObjectId,
    extractJSONString,
    preprocessJSON
};