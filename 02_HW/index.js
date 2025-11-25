// Wait for the DOM to be fully loaded before accessing elements
document.addEventListener("DOMContentLoaded", () => {
    pageLoaded();
});

let txt1;       // to the first number input field
let txt2;       // to the second number input field
let btnCalc;    // to the "=" button that triggers the calculation
let lblRes;     // to the top-right result display (green text)
let lblRes2;    // to the large result panel below
let selectOp;   // operator dropdown (+, -, *, /)

/**
 * Validate a single input element as numeric (not empty, not NaN).
 * Adds Bootstrap classes is-valid / is-invalid accordingly.
 */
function validateInput(inputElement) {
    const value = inputElement.value;

    // If empty or not a number → treat as invalid
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
 * Initialize references to DOM elements and register event listeners.
 */
function pageLoaded() {
    txt1 = document.getElementById('txt1');
    txt2 = document.getElementById('txt2');
    btnCalc = document.getElementById('btnCalc');
    lblRes = document.getElementById('lblRes');
    lblRes2 = document.getElementById('lblRes2'); // Result box below main row
    selectOp = document.getElementById('op');

    btnCalc.addEventListener('click', () => {
        calculate();
    });
}

/**
 * Perform the calculation according to the selected operator and
 * update both result labels + log.
 */
function calculate() {
    // Validate both input fields before performing calculation
    const valid1 = validateInput(txt1);
    const valid2 = validateInput(txt2);

    // If one of the inputs is invalid → clear results and stop
    if (!valid1 || !valid2) {
        lblRes.innerText = "";
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

    // Update on-screen results
    lblRes.innerText = res;
    lblRes2.innerText = res;

    // Append operation summary to log
    print(`${num1} ${op} ${num2} = ${res}`, true);
}

// ---------------------------------------------
// Button 2 click example
// ---------------------------------------------
const btn2 = document.getElementById("btn2");
btn2.addEventListener("click", () => {
    print("btn2 clicked :" + btn2.id + "|" + btn2.innerText, true);
});

/**
 * Write a message to the textarea log.
 * If append = true → add a new line at the bottom.
 * If append = false → replace the existing content.
 */
function print(msg, append = false) {

    // Get TextArea element reference
    const ta = document.getElementById("output");

    if (!ta) {
        console.log(msg);
        return;
    }

    // Write to log
    if (append) {
        // Append at the end with a new line
        ta.value += (ta.value ? "\n" : "") + msg;
    } else {
        // Replace entire content
        ta.value = msg;
    }
}

// =============================================
// STEP 1: JS NATIVE TYPES, USEFUL TYPES & OPERATIONS
// =============================================
function demoNative() {
    let out = "=== STEP 1: NATIVE TYPES ===\n";

    // String
    const s = "Hello World";
    out += "\n[String] s = " + s;
    out += "\nLength: " + s.length;
    out += "\nUpper: " + s.toUpperCase();

    // Number
    const n = 42;
    out += "\n\n[Number] n = " + n;

    // Boolean
    const b = true;
    out += "\n\n[Boolean] b = " + b;

    // Date
    const d = new Date();
    out += "\n\n[Date] now = " + d.toISOString();

    // Array
    const arr = [1, 2, 3, 4];
    out += "\n\n[Array] arr = [" + arr.join(", ") + "]";
    out += "\nPush 5 → " + (arr.push(5), arr.join(", "));
    out += "\nMap x2 → " + arr.map(x => x * 2).join(", ");

    // Functions as variables
    const add = function (a, b) { return a + b; };
    out += "\n\n[Function as variable] add(3,4) = " + add(3, 4);

    // Callback
    function calc(a, b, fn) {
        return fn(a, b);
    }
    const result = calc(10, 20, (x, y) => x + y);
    out += "\n[Callback] calc(10,20, x+y ) = " + result;

    // Print to log (replace content)
    print(out);
}
