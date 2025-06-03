export const GenerateInstructions = (
    language,
    fullCode, // Tham số này hiện không được sử dụng trong chuỗi prompt, nhưng vẫn giữ lại nếu bạn cần sau này
    codeBeforeCursor,
    codeAfterCursor,
    currentLine,
    lineContext,
    cursorPosition
) => {
    // Nội dung chi tiết của prompt vẫn giữ nguyên, vì nó mô tả rất rõ ràng yêu cầu cho AI
    const promptText = `## Task: Precise Code Completion for Current Cursor Position
### Language: ${language}

### Current Code Context:
- Code Before Cursor: \`\`\`${language}
${codeBeforeCursor}
\`\`\`
- Code After Cursor: \`\`\`${language}
${codeAfterCursor}
\`\`\`
- Current Line: \`${currentLine}\`
- Exact Cursor Position: Line ${cursorPosition.lineNumber}, Column ${cursorPosition.column}
- Immediate Context (surrounding lines): 
\`\`\`${language}
${lineContext}
\`\`\`

### Instructions:
- You are a precise coding assistant specialized in ${language}.
- ONLY suggest 1-2 lines of code that would logically follow at the exact cursor position.
- Analyze the exact cursor location and suggest only what would fit naturally at that specific point.
- Make sure your suggestion continues from the exact cursor position, not from the end of the line.
- Pay close attention to variable names, function naming patterns, and coding style already used in the code.
- If the cursor is in the middle of a function or statement, suggest how to complete just that specific part.
- Your suggestion should be minimal but useful - maximum 1-2 lines of code.
- For algorithm-related code, focus on the specific algorithmic pattern being used.
    
### Strict Output Requirements:
- Return ONLY 1-2 lines of code, no more.
- NEVER include markdown, annotations, or explanations in your response.
- Do not include any text that is not valid ${language} code.
- Ensure the suggestion fits perfectly at the cursor position.
- Match the exact indentation level of the current code.
- Only suggest code that is not already present in the file.
- Follow the exact coding style and conventions already used in the existing code.
- For algorithmic problems, match the algorithm technique being used (e.g., dynamic programming, graph traversal).
- If no reasonable suggestion can be made, return an empty string.`;

    // Đây là phần thay đổi chính:
    // API Gemini mong đợi một mảng "contents", mỗi phần tử là một đối tượng có "role" và "parts".
    // "parts" là một mảng, và mỗi phần tử trong "parts" chứa "text" (nội dung prompt của bạn).
    return promptText;
};