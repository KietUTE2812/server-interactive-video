function convertCode(code, input, language, codeExecute) {
    // Nếu không có codeExecute, trả về code gốc
    if (!codeExecute) {
        return code;
    }

    const codeConvert = replaceSolution(code, codeExecute, language);

    // Nếu không có input hoặc input rỗng, trả về code đã được convert
    if (!input || input.trim() === '') {
        return codeConvert;
    }

    // Kiểm tra nếu template sử dụng Scanner, không cần replace parameters
    // vì data sẽ đến từ stdin
    if (codeExecute && codeExecute.includes('Scanner')) {
        console.log("Template uses Scanner, skipping parameter replacement");
        return codeConvert;
    }

    // Tách các biến từ input
    const params = {};

    try {
        input.split(';').forEach(param => {
            const trimmedParam = param.trim();
            if (!trimmedParam) return; // Bỏ qua param rỗng

            const equalIndex = trimmedParam.indexOf('=');
            if (equalIndex === -1) return; // Bỏ qua param không có dấu =

            const key = trimmedParam.substring(0, equalIndex).trim();
            const value = trimmedParam.substring(equalIndex + 1).trim();

            if (!key || !value) return; // Bỏ qua nếu key hoặc value rỗng

            // Nhận diện và xử lý mảng
            if (value.startsWith('[') && value.endsWith(']')) {
                const arrayContent = value.slice(1, -1).trim();
                params[key] = {
                    type: 'array',
                    value: arrayContent ? arrayContent.split(',').map(v => v.trim()) : []
                };
            } else {
                params[key] = {
                    type: 'primitive',
                    value: value
                };
            }
        });
    } catch (error) {
        console.warn("Error parsing input parameters:", error.message);
        // Trả về code đã convert mà không thay thế params
        return codeConvert;
    }

    // Nếu không có params hợp lệ, trả về code đã convert
    if (Object.keys(params).length === 0) {
        return codeConvert;
    }

    console.log("Proceeding with parameter replacement for non-Scanner template");

    // Xử lý theo từng ngôn ngữ
    try {
        switch (language.toLowerCase()) {
            case 'java':
                return replaceJava(codeConvert, params);
            case 'cpp':
                return replaceCpp(codeConvert, params);
            case 'c':
                return replaceC(codeConvert, params);
            case 'python':
                return replacePython(codeConvert, params);
            case 'javascript':
                return replaceJavaScript(codeConvert, params);
            default:
                console.warn(`Unsupported language for parameter replacement: ${language}`);
                return codeConvert;
        }
    } catch (error) {
        console.warn(`Error replacing parameters for ${language}:`, error.message);
        return codeConvert;
    }
}

function replaceSolution(code, codeExecute, language) {
    if (!code || !codeExecute) {
        return code || codeExecute || '';
    }

    // Xử lý đặc biệt cho từng ngôn ngữ để đảm bảo syntax đúng
    switch (language && language.toLowerCase()) {
        case 'java':
            return replaceJavaSolution(code, codeExecute);
        case 'cpp':
            return replaceCppSolution(code, codeExecute);
        case 'c':
            return replaceCSolution(code, codeExecute);
        case 'python':
            return replacePythonSolution(code, codeExecute);
        case 'javascript':
            return replaceJavaScriptSolution(code, codeExecute);
        default:
            // Xử lý cho các ngôn ngữ khác hoặc không xác định
            console.warn(`No specific handler for language: ${language}, using default replacement`);
            let modifiedCodeExecute = codeExecute.replace(/solutionCode/g, code);
            return modifiedCodeExecute;
    }
}

function replaceJavaSolution(userCode, template) {
    try {
        // Tìm vị trí của //solutionCode trong template
        const solutionCodeIndex = template.indexOf('//solutionCode');
        if (solutionCodeIndex === -1) {
            return template.replace(/solutionCode/g, userCode);
        }

        // Tách template thành 2 phần: trước và sau //solutionCode
        const beforeSolution = template.substring(0, solutionCodeIndex);
        const afterSolution = template.substring(solutionCodeIndex + '//solutionCode'.length);

        // Làm sạch userCode
        let cleanUserCode = userCode.trim();

        // Loại bỏ import statements từ userCode vì template đã có
        cleanUserCode = cleanUserCode.replace(/import\s+[^;]+;\s*/g, '');

        // Loại bỏ các comment không cần thiết
        cleanUserCode = cleanUserCode.replace(/\/\/.*$/gm, '');

        // Loại bỏ các dòng trống thừa
        cleanUserCode = cleanUserCode.replace(/\n\s*\n/g, '\n').trim();

        // JAVA SPECIFIC: Xử lý cấu trúc class theo yêu cầu Java
        let processedSolution = processJavaClassStructure(cleanUserCode, afterSolution);

        // Ghép các phần lại với nhau
        let result = beforeSolution + processedSolution;

        // Làm sạch kết quả cuối cùng
        result = result.replace(/\r\n/g, '\n');
        result = result.replace(/\n{3,}/g, '\n\n');

        console.log("Java merge result:", result);
        return result;

    } catch (error) {
        console.error("Error in replaceJavaSolution:", error.message);
        return template.replace(/solutionCode/g, userCode);
    }
}

function processJavaClassStructure(userCode, afterSolution) {
    // Kiểm tra xem afterSolution có Main class không
    const hasMainClass = afterSolution.includes('class Main');

    if (hasMainClass) {
        // Template có Main class → đặt Solution class bên trong Main class
        if (userCode.includes('class Solution')) {
            // Remove class declaration, keep only content
            let solutionContent = userCode.replace(/class\s+Solution\s*\{/, '').trim();
            // Remove last closing brace
            solutionContent = solutionContent.replace(/\}[\s]*$/, '').trim();

            // Indent solution content
            solutionContent = solutionContent.split('\n').map(line => '    ' + line).join('\n');

            // Wrap as static inner class
            return `static class Solution {\n${solutionContent}\n    }\n\n` + afterSolution;
        } else {
            // User code chỉ có methods → wrap trong static inner class
            const indentedCode = userCode.split('\n').map(line => '        ' + line).join('\n');
            return `static class Solution {\n${indentedCode}\n    }\n\n` + afterSolution;
        }
    } else {
        // Template không có Main class → tạo structure thông thường
        if (!userCode.includes('class Solution')) {
            userCode = `class Solution {\n    ${userCode.replace(/\n/g, '\n    ')}\n}`;
        }
        return userCode + '\n\n' + afterSolution;
    }
}

function replaceCppSolution(userCode, template) {
    try {
        const solutionCodeIndex = template.indexOf('//solutionCode');
        if (solutionCodeIndex === -1) {
            return template.replace(/solutionCode/g, userCode);
        }

        const beforeSolution = template.substring(0, solutionCodeIndex);
        const afterSolution = template.substring(solutionCodeIndex + '//solutionCode'.length);

        let cleanUserCode = userCode.trim();

        // Loại bỏ include statements từ userCode vì template đã có
        cleanUserCode = cleanUserCode.replace(/#include\s*<[^>]+>\s*/g, '');
        cleanUserCode = cleanUserCode.replace(/#include\s*"[^"]+"\s*/g, '');
        cleanUserCode = cleanUserCode.replace(/using\s+namespace\s+\w+\s*;\s*/g, '');

        // C++ SPECIFIC: Xử lý cấu trúc cho C++
        let processedSolution = processCppStructure(cleanUserCode);

        let result = beforeSolution + processedSolution + afterSolution;
        result = result.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n');

        console.log("C++ merge result:", result);
        return result;

    } catch (error) {
        console.error("Error in replaceCppSolution:", error.message);
        return template.replace(/solutionCode/g, userCode);
    }
}

function processCppStructure(userCode) {
    // C++ thường sử dụng class hoặc functions
    if (userCode.includes('class Solution')) {
        return userCode;
    } else if (userCode.includes('class ')) {
        // Đã có class khác, giữ nguyên
        return userCode;
    } else {
        // Chỉ có functions → wrap trong class Solution
        const indentedCode = userCode.split('\n').map(line => '    ' + line).join('\n');
        return `class Solution {\npublic:\n${indentedCode}\n};`;
    }
}

function replacePythonSolution(userCode, template) {
    try {
        const solutionCodeIndex = template.indexOf('#solutionCode');
        let searchComment = '#solutionCode';

        if (solutionCodeIndex === -1) {
            const altIndex = template.indexOf('//solutionCode');
            if (altIndex !== -1) {
                searchComment = '//solutionCode';
            } else {
                return template.replace(/solutionCode/g, userCode);
            }
        }

        const commentIndex = template.indexOf(searchComment);
        const beforeSolution = template.substring(0, commentIndex);
        const afterSolution = template.substring(commentIndex + searchComment.length);

        let cleanUserCode = userCode.trim();

        // Loại bỏ import statements từ userCode vì template đã có
        cleanUserCode = cleanUserCode.replace(/^import\s+[^\n]+\n?/gm, '');
        cleanUserCode = cleanUserCode.replace(/^from\s+[^\n]+\n?/gm, '');

        // PYTHON SPECIFIC: Xử lý cấu trúc cho Python
        let processedSolution = processPythonStructure(cleanUserCode);

        let result = beforeSolution + processedSolution + afterSolution;
        result = result.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n');

        console.log("Python merge result:", result);
        return result;

    } catch (error) {
        console.error("Error in replacePythonSolution:", error.message);
        return template.replace(/solutionCode/g, userCode);
    }
}

function processPythonStructure(userCode) {
    // Python: class Solution hoặc standalone functions
    if (userCode.includes('class Solution')) {
        return userCode;
    } else if (userCode.includes('def ') && userCode.includes('class ')) {
        // Đã có class, giữ nguyên
        return userCode;
    } else if (userCode.includes('def ')) {
        // Chỉ có functions → wrap trong class Solution
        const indentedCode = userCode.split('\n').map(line => '    ' + line).join('\n');
        return `class Solution:\n${indentedCode}`;
    } else {
        // Code snippets khác
        return userCode;
    }
}

function replaceJavaScriptSolution(userCode, template) {
    try {
        const solutionCodeIndex = template.indexOf('//solutionCode');
        if (solutionCodeIndex === -1) {
            return template.replace(/solutionCode/g, userCode);
        }

        const beforeSolution = template.substring(0, solutionCodeIndex);
        const afterSolution = template.substring(solutionCodeIndex + '//solutionCode'.length);

        let cleanUserCode = userCode.trim();

        // Loại bỏ require/import statements từ userCode vì template đã có
        cleanUserCode = cleanUserCode.replace(/^const\s+[^=]+\s*=\s*require\([^)]+\);\s*/gm, '');
        cleanUserCode = cleanUserCode.replace(/^import\s+[^;]+;\s*/gm, '');

        // JAVASCRIPT SPECIFIC: Xử lý cấu trúc cho JavaScript
        let processedSolution = processJavaScriptStructure(cleanUserCode);

        let result = beforeSolution + processedSolution + afterSolution;
        result = result.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n');

        console.log("JavaScript merge result:", result);
        return result;

    } catch (error) {
        console.error("Error in replaceJavaScriptSolution:", error.message);
        return template.replace(/solutionCode/g, userCode);
    }
}

function processJavaScriptStructure(userCode) {
    // JavaScript: class, functions, hoặc object
    if (userCode.includes('class Solution')) {
        return userCode;
    } else if (userCode.includes('class ')) {
        // Đã có class khác
        return userCode;
    } else if (userCode.includes('function ') || userCode.includes('const ') || userCode.includes('let ')) {
        // Functions/variables → có thể wrap trong class hoặc giữ nguyên
        return userCode;
    } else {
        // Raw code
        return userCode;
    }
}

// Hàm replace cho Java
function replaceJava(code, params) {
    let modifiedCode = code;
    console.log("=== JAVA PARAMETER REPLACEMENT ===");
    console.log("Original code snippet:", code.substring(0, 200) + "...");
    console.log("Parameters to replace:", params);

    for (const [key, param] of Object.entries(params)) {
        try {
            console.log(`\n--- Replacing parameter: ${key} ---`);
            console.log(`Type: ${param.type}, Value: ${JSON.stringify(param.value)}`);

            // Xử lý mảng
            if (param.type === 'array') {
                // Tìm và replace các pattern khác nhau cho Java array/List
                const arrayPatterns = [
                    // Pattern 1: Arrays.asList(any values)
                    new RegExp(`(List<\\w+>\\s+${key}\\s*=\\s*)Arrays\\.asList\\([^)]*\\)`, 'g'),
                    // Pattern 2: new ArrayList<>(Arrays.asList(any values))
                    new RegExp(`(List<\\w+>\\s+${key}\\s*=\\s*)new\\s+ArrayList<>\\(Arrays\\.asList\\([^)]*\\)\\)`, 'g'),
                    // Pattern 3: new int[]{any values}
                    new RegExp(`(int\\[\\]\\s+${key}\\s*=\\s*)new\\s+int\\[\\]\\{[^}]*\\}`, 'g'),
                    // Pattern 4: {values} format
                    new RegExp(`(int\\[\\]\\s+${key}\\s*=\\s*)\\{[^}]*\\}`, 'g'),
                    // Pattern 5: Variable without explicit type (for reassignment)
                    new RegExp(`(\\s+${key}\\s*=\\s*)Arrays\\.asList\\([^)]*\\)`, 'g'),
                    new RegExp(`(\\s+${key}\\s*=\\s*)new\\s+int\\[\\]\\{[^}]*\\}`, 'g')
                ];

                const formattedArray = `Arrays.asList(${param.value.join(', ')})`;
                console.log(`Formatted array: ${formattedArray}`);

                let replacementCount = 0;
                arrayPatterns.forEach((pattern, index) => {
                    const originalCode = modifiedCode;
                    modifiedCode = modifiedCode.replace(pattern, `$1${formattedArray}`);
                    if (originalCode !== modifiedCode) {
                        console.log(`✅ Pattern ${index + 1} matched and replaced`);
                        replacementCount++;
                    }
                });

                // Fallback cho trường hợp đơn giản
                if (replacementCount === 0) {
                    console.log("🔄 Trying fallback patterns...");
                    const simpleArrayRegex = new RegExp(`int\\[\\]\\s*${key}\\s*=\\s*[^;]*;`, 'g');
                    const originalCode = modifiedCode;
                    modifiedCode = modifiedCode.replace(simpleArrayRegex, `int[] ${key} = new int[]{${param.value.join(', ')}};`);
                    if (originalCode !== modifiedCode) {
                        console.log("✅ Fallback pattern matched");
                        replacementCount++;
                    }
                }

                if (replacementCount === 0) {
                    console.log(`⚠️ No patterns matched for array parameter: ${key}`);
                }
            }
            // Xử lý biến đơn
            else if (param.type === 'primitive') {
                // Tìm các pattern khác nhau cho primitive values
                const primitivePatterns = [
                    // Pattern 1: int x_val = any_value;
                    new RegExp(`(int\\s+${key}\\s*=\\s*)[^;]*;`, 'g'),
                    // Pattern 2: int x = any_value; (remove _val suffix)
                    new RegExp(`(int\\s+${key.replace('_val', '')}\\s*=\\s*)[^;]*;`, 'g'),
                    // Pattern 3: Variable without type (reassignment)
                    new RegExp(`(\\s+${key}\\s*=\\s*)[^;]*;`, 'g'),
                    new RegExp(`(\\s+${key.replace('_val', '')}\\s*=\\s*)[^;]*;`, 'g'),
                    // Pattern 4: Other types
                    new RegExp(`((?:String|double|float|boolean)\\s+${key}\\s*=\\s*)[^;]*;`, 'g')
                ];

                const valueToUse = isNaN(param.value) ? `"${param.value}"` : param.value;
                console.log(`Formatted value: ${valueToUse}`);

                let replacementCount = 0;
                primitivePatterns.forEach((pattern, index) => {
                    const originalCode = modifiedCode;
                    modifiedCode = modifiedCode.replace(pattern, `$1${valueToUse};`);
                    if (originalCode !== modifiedCode) {
                        console.log(`✅ Primitive pattern ${index + 1} matched and replaced`);
                        replacementCount++;
                    }
                });

                if (replacementCount === 0) {
                    console.log(`⚠️ No patterns matched for primitive parameter: ${key}`);
                }
            }
        } catch (error) {
            console.error(`❌ Error replacing Java parameter ${key}:`, error.message);
        }
    }

    console.log("=== REPLACEMENT COMPLETE ===");
    console.log("Modified code snippet:", modifiedCode.substring(0, 200) + "...");
    console.log("=====================================");
    return modifiedCode;
}

// Hàm replace cho C++
function replaceCpp(code, params) {
    let modifiedCode = code;

    for (const [key, param] of Object.entries(params)) {
        try {
            // Xử lý mảng
            if (param.type === 'array') {
                const formattedArray = `{${param.value.join(', ')}}`;

                // Tìm và thay thế khai báo mảng với bất kỳ tên biến nào
                const regex = new RegExp(`(vector<int>|int\\[\\])\\s*${key}\\s*=\\s*[^;]*;`, 'g');
                modifiedCode = modifiedCode.replace(regex, `vector<int> ${key} = ${formattedArray};`);
            }
            // Xử lý biến đơn
            else if (param.type === 'primitive') {
                const regex = new RegExp(`(int|string|vector<int>)?\\s*${key}\\s*=\\s*[^;]*;`, 'g');
                modifiedCode = modifiedCode.replace(regex, (match, type) => {
                    const valueToUse = isNaN(param.value) ? `"${param.value}"` : param.value;
                    return `${type ? type + ' ' : ''}${key} = ${valueToUse};`;
                });
            }
        } catch (error) {
            console.warn(`Error replacing C++ parameter ${key}:`, error.message);
        }
    }

    return modifiedCode;
}

// Hàm replace cho C
function replaceC(code, params) {
    let modifiedCode = code;

    for (const [key, param] of Object.entries(params)) {
        try {
            // Xử lý mảng
            if (param.type === 'array') {
                const formattedArray = `{${param.value.join(', ')}}`;

                // Tìm và thay thế khai báo mảng với bất kỳ tên biến nào
                const regex = new RegExp(`int\\s*${key}\\[\\]\\s*=\\s*[^;]*;`, 'g');
                modifiedCode = modifiedCode.replace(regex, `int ${key}[] = ${formattedArray};`);
            }
            // Xử lý biến đơn
            else if (param.type === 'primitive') {
                const regex = new RegExp(`(int|char\\*|float|double)?\\s*${key}\\s*=\\s*[^;]*;`, 'g');
                modifiedCode = modifiedCode.replace(regex, (match, type) => {
                    const valueToUse = isNaN(param.value) ? `"${param.value}"` : param.value;
                    return `${type ? type + ' ' : ''}${key} = ${valueToUse};`;
                });
            }
        } catch (error) {
            console.warn(`Error replacing C parameter ${key}:`, error.message);
        }
    }

    return modifiedCode;
}

// Hàm replace cho Python
function replacePython(code, params) {
    let modifiedCode = code;

    for (const [key, param] of Object.entries(params)) {
        try {
            const regex = new RegExp(`${key}\\s*=\\s*[^\\n]*`, 'g');
            modifiedCode = modifiedCode.replace(regex, () => {
                if (param.type === 'array') {
                    return `${key} = [${param.value.join(', ')}]`;
                } else {
                    const valueToUse = isNaN(param.value) ? `"${param.value}"` : param.value;
                    return `${key} = ${valueToUse}`;
                }
            });
        } catch (error) {
            console.warn(`Error replacing Python parameter ${key}:`, error.message);
        }
    }

    return modifiedCode;
}

// Hàm replace cho JavaScript
function replaceJavaScript(code, params) {
    let modifiedCode = code;

    for (const [key, param] of Object.entries(params)) {
        try {
            const regex = new RegExp(`(let|const|var)?\\s*${key}\\s*=\\s*[^;\\n]*`, 'g');
            modifiedCode = modifiedCode.replace(regex, (match, type) => {
                if (param.type === 'array') {
                    return `${type ? type + ' ' : ''}${key} = [${param.value.join(', ')}]`;
                } else {
                    const valueToUse = isNaN(param.value) ? `"${param.value}"` : param.value;
                    return `${type ? type + ' ' : ''}${key} = ${valueToUse}`;
                }
            });
        } catch (error) {
            console.warn(`Error replacing JavaScript parameter ${key}:`, error.message);
        }
    }

    return modifiedCode;
}

// C language handler
function replaceCSolution(userCode, template) {
    try {
        const solutionCodeIndex = template.indexOf('//solutionCode');
        if (solutionCodeIndex === -1) {
            return template.replace(/solutionCode/g, userCode);
        }

        const beforeSolution = template.substring(0, solutionCodeIndex);
        const afterSolution = template.substring(solutionCodeIndex + '//solutionCode'.length);

        let cleanUserCode = userCode.trim();

        // Loại bỏ include statements từ userCode vì template đã có
        cleanUserCode = cleanUserCode.replace(/#include\s*<[^>]+>\s*/g, '');
        cleanUserCode = cleanUserCode.replace(/#include\s*"[^"]+"\s*/g, '');

        // C SPECIFIC: Xử lý cấu trúc cho C
        let processedSolution = processCStructure(cleanUserCode);

        let result = beforeSolution + processedSolution + afterSolution;
        result = result.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n');

        console.log("C merge result:", result);
        return result;

    } catch (error) {
        console.error("Error in replaceCSolution:", error.message);
        return template.replace(/solutionCode/g, userCode);
    }
}

function processCStructure(userCode) {
    // C: functions, structs
    if (userCode.includes('struct ') || userCode.includes('typedef ')) {
        return userCode;
    } else if (userCode.includes('int ') || userCode.includes('void ') || userCode.includes('char ')) {
        // Functions - giữ nguyên vì C không có class concept
        return userCode;
    } else {
        // Raw code
        return userCode;
    }
}

export default convertCode;