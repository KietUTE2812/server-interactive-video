function convertCode(code, input, language, codeExecute) {
    const codeConvert = replaceSolution(code, codeExecute);
    // Tách các biến từ input
    const params = {};
    input.split(';').forEach(param => {
        const [key, value] = param.trim().split('=').map(item => item.trim());
        params[key] = value;
    });
    console.log("params: ", params);

    // Xử lý theo từng ngôn ngữ
    switch (language.toLowerCase()) {
        case 'java':
            return replaceJava(codeConvert, params);
        case 'cpp':
            return replaceCpp(codeConvert, params);
        case 'c':
            return replaceC(codeConvert, params);
        case 'python':
            return replacePython(codeConvert, params);
        default:
            throw new Error(`Unsupported language: ${language}`);
    }
}
function replaceSolution(code, codeExecute) {
    let modifiedCodeExecute = codeExecute.replace(/solutionCode/g, code);

    return modifiedCodeExecute;
}

// Hàm replace cho Java
function replaceJava(code, params) {
    let modifiedCode = code;

    // Thay thế các biến trong Java
    for (const [key, value] of Object.entries(params)) {
        // Regex để tìm khai báo biến trong Java
        const regex = new RegExp(`(int|String|double|float|boolean|List<Integer>)?\\s*${key}\\s*=\\s*[^;]*;`);
        modifiedCode = modifiedCode.replace(regex, (match, type) => {
            return `${type ? type + ' ' : ''}${key} = ${value};`;
        });
    }

    return modifiedCode;
}

// Hàm replace cho C++
function replaceCpp(code, params) {
    let modifiedCode = code;

    // Thay thế các biến trong C++
    for (const [key, value] of Object.entries(params)) {
        // Regex để tìm khai báo biến trong C++
        const regex = new RegExp(`(int|string|vector<int>)?\\s*${key}\\s*=\\s*[^;]*;`);
        modifiedCode = modifiedCode.replace(regex, (match, type) => {
            return `${type ? type + ' ' : ''}${key} = ${value};`;
        });
    }

    return modifiedCode;
}

// Hàm replace cho C
function replaceC(code, params) {
    let modifiedCode = code;

    // Thay thế các biến trong C
    for (const [key, value] of Object.entries(params)) {
        // Regex để tìm khai báo biến trong C
        const regex = new RegExp(`(int|char\\*|float|double)?\\s*${key}\\s*=\\s*[^;]*;`);
        modifiedCode = modifiedCode.replace(regex, (match, type) => {
            return `${type ? type + ' ' : ''}${key} = ${value};`;
        });
    }

    return modifiedCode;
}

// Hàm replace cho Python
function replacePython(code, params) {
    let modifiedCode = code;

    // Thay thế các biến trong Python
    for (const [key, value] of Object.entries(params)) {
        // Regex để tìm khai báo biến trong Python
        const regex = new RegExp(`${key}\\s*=\\s*[^\\n]*`);
        modifiedCode = modifiedCode.replace(regex, () => {
            return `${key} = ${value}`;
        });
    }

    return modifiedCode;
}

export default convertCode;