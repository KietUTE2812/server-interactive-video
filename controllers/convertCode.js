function convertCode(code, input, language, codeExecute) {
    const codeConvert = replaceSolution(code, codeExecute);
    // Tách các biến từ input
    const params = {};
    input.split(';').forEach(param => {
        const [key, value] = param.trim().split('=').map(item => item.trim());

        // Nhận diện và xử lý mảng
        if (value.startsWith('[') && value.endsWith(']')) {
            params[key] = {
                type: 'array',
                value: value.replace(/[\[\]]/g, '').split(',').map(v => v.trim())
            };
        } else {
            params[key] = {
                type: 'primitive',
                value: value
            };
        }
    });

    //console.log("params: ", params);

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

    for (const [key, param] of Object.entries(params)) {
        // Xử lý mảng
        if (param.type === 'array') {
            const formattedArray = `new int[]{${param.value.join(', ')}}`;

            // Tìm và thay thế khai báo mảng với bất kỳ tên biến nào
            const regex = new RegExp(`int\\[\\]\\s*${key}\\s*=\\s*[^;]*;`);
            modifiedCode = modifiedCode.replace(regex, `int[] ${key} = ${formattedArray};`);
        }
        // Xử lý biến đơn
        else if (param.type === 'primitive') {
            const regex = new RegExp(`(int|String|double|float|boolean)?\\s*${key}\\s*=\\s*[^;]*;`);
            modifiedCode = modifiedCode.replace(regex, (match, type) => {
                return `${type ? type + ' ' : ''}${key} = ${param.value};`;
            });
        }
    }

    return modifiedCode;
}

// Hàm replace cho C++
function replaceCpp(code, params) {
    let modifiedCode = code;

    for (const [key, param] of Object.entries(params)) {
        // Xử lý mảng
        if (param.type === 'array') {
            const formattedArray = `{${param.value.join(', ')}}`;

            // Tìm và thay thế khai báo mảng với bất kỳ tên biến nào
            const regex = new RegExp(`(vector<int>|int\\[\\])\\s*${key}\\s*=\\s*[^;]*;`);
            modifiedCode = modifiedCode.replace(regex, `vector<int> ${key} = ${formattedArray};`);
        }
        // Xử lý biến đơn
        else if (param.type === 'primitive') {
            const regex = new RegExp(`(int|string|vector<int>)?\\s*${key}\\s*=\\s*[^;]*;`);
            modifiedCode = modifiedCode.replace(regex, (match, type) => {
                return `${type ? type + ' ' : ''}${key} = ${param.value};`;
            });
        }
    }

    return modifiedCode;
}

// Hàm replace cho C
function replaceC(code, params) {
    let modifiedCode = code;

    for (const [key, param] of Object.entries(params)) {
        // Xử lý mảng
        if (param.type === 'array') {
            const formattedArray = `{${param.value.join(', ')}}`;

            // Tìm và thay thế khai báo mảng với bất kỳ tên biến nào
            const regex = new RegExp(`int\\s*${key}\\[\\]\\s*=\\s*[^;]*;`);
            modifiedCode = modifiedCode.replace(regex, `int ${key}[] = ${formattedArray};`);
        }
        // Xử lý biến đơn
        else if (param.type === 'primitive') {
            const regex = new RegExp(`(int|char\\*|float|double)?\\s*${key}\\s*=\\s*[^;]*;`);
            modifiedCode = modifiedCode.replace(regex, (match, type) => {
                return `${type ? type + ' ' : ''}${key} = ${param.value};`;
            });
        }
    }

    return modifiedCode;
}

// Hàm replace cho Python
function replacePython(code, params) {
    let modifiedCode = code;

    for (const [key, param] of Object.entries(params)) {
        const regex = new RegExp(`${key}\\s*=\\s*[^\\n]*`);
        modifiedCode = modifiedCode.replace(regex, () => {
            return `${key} = ${param.type === 'array' ? param.value : param.value}`;
        });
    }

    return modifiedCode;
}


export default convertCode;