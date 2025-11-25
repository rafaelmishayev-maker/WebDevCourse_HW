// Wait until the DOM is fully loaded
document.addEventListener("DOMContentLoaded", () => {
    pageLoaded();
});

// Input fields, buttons, result box, operator dropdown
let txt1;
let txt2;
let btnCalc;
let lblRes2;     // Main result box
let selectOp;

/**
 * Validate an input field to ensure it contains a numeric value.
 * Adds Bootstrap validation classes is-valid / is-invalid.
 */
function validateInput(inputElement) {
    const value = inputElement.value;

    // If empty or not a number → mark as invalid
    if (value.trim() === "" || isNaN(value)) {
        inputElement.classList.remove("is-valid");
        inputElement.classList.add("is-invalid");
        return false;
    } else {
        inputElement.classList.remove("is-invalid");
        inputElement.classList.add("is-valid");
        return true;
    }
}

/**
 * Initialize DOM references and register event listeners.
 */
function pageLoaded() {
    txt1 = document.getElementById('txt1');
    txt2 = document.getElementById('txt2');
    btnCalc = document.getElementById('btnCalc');
    lblRes2 = document.getElementById('lblRes2');  // Only result output used
    selectOp = document.getElementById('op');

    btnCalc.addEventListener('click', () => {
        calculate();
    });
}

/**
 * Perform the arithmetic operation and update the result + log.
 */
function calculate() {
    const valid1 = validateInput(txt1);
    const valid2 = validateInput(txt2);

    // Stop calculation if one of the inputs is invalid
    if (!valid1 || !valid2) {
        lblRes2.innerText = "";
        return;
    }

    const num1 = parseFloat(txt1.value);
    const num2 = parseFloat(txt2.value);
    const op = selectOp.value;

    let res;

    switch (op) {
        case '+': res = num1 + num2; break;
        case '-': res = num1 - num2; break;
        case '*': res = num1 * num2; break;
        case '/': res = (num2 === 0) ? "Error (division by 0)" : num1 / num2; break;
        default: res = "NaN";
    }

    // Update ONLY the result box
    lblRes2.innerText = res;

    // Append to log
    print(`${num1} ${op} ${num2} = ${res}`, true);
}

/**
 * Writes a message to the log textarea.
 * append = true → adds a new line at the bottom.
 */
function print(msg, append = false) {

    const ta = document.getElementById("output");

    if (!ta) {
        console.log(msg);
        return;
    }

    if (append) {
        // Append to the end
        ta.value += (ta.value ? "\n" : "") + msg;
    } else {
        // Replace all content
        ta.value = msg;
    }
}

// ----------------------------------------------------
// Demo Section (Native JS Types)
// ----------------------------------------------------

function demoNative() {
    let out = "=== STEP 1: NATIVE TYPES ===\n";

    // String example
    const s = "Hello World";
    out += "\n[String] s = " + s;
    out += "\nLength: " + s.length;
    out += "\nUpper: " + s.toUpperCase();

    // Number example
    const n = 42;
    out += "\n\n[Number] n = " + n;

    // Boolean example
    const b = true;
    out += "\n\n[Boolean] b = " + b;

    // Date example
    const d = new Date();
    out += "\n\n[Date] now = " + d.toISOString();

    // Array example
    const arr = [1, 2, 3, 4];
    out += "\n\n[Array] arr = [" + arr.join(", ") + "]";
    out += "\nPush 5 → " + (arr.push(5), arr.join(", "));
    out += "\nMap x2 → " + arr.map(x => x * 2).join(", ");

    // Function as variable
    const add = function (a, b) { return a + b; };
    out += "\n\n[Function as variable] add(3,4) = " + add(3, 4);

    // Callback example
    function calc(a, b, fn) {
        return fn(a, b);
    }
    const result = calc(10, 20, (x, y) => x + y);
    out += "\n[Callback] calc(10,20, x+y ) = " + result;

    // Print demo output
    print(out);
}
