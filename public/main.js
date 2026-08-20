import {syllable} from 'https://esm.sh/syllable@5?bundle'

// small helper so LOAD and GENERATE don't each carry their own copy-pasted
// lock/setTimeout debounce logic - wraps a handler so it can only run once
// per `ms`, ignoring clicks that land while it's locked
function debounce(fn, ms) {
    let locked = false;
    return function (...args) {
        if (locked) return;
        locked = true;
        setTimeout(function () {
            locked = false;
        }, ms);
        return fn.apply(this, args);
    };
}

// VVVVVVVVVV SUBMIT CODE VVVVVVVVVV
const textAreaOne = document.getElementById('firstLine');
const textAreaOneCount = document.getElementById('firstLineCount');

const textAreaTwo = document.getElementById('secondLine');
const textAreaTwoCount = document.getElementById('secondLineCount');

const textAreaThree = document.getElementById('thirdLine');
const textAreaThreeCount = document.getElementById('thirdLineCount');

function syllableColor(syllableCount, limit){
    if(syllableCount < limit){
         return "white";
    }
    else if (syllableCount === limit){
        return "green";
    }
    else if (syllableCount > limit){
        return "red";
    }
}

textAreaOne.addEventListener('input', function() {
    const currentValueOne = textAreaOne.value;
    const limit = 5;
    var syllableCount = syllable(currentValueOne);
    textAreaOneCount.textContent = syllableCount + "/5";
    textAreaOneCount.style.color = syllableColor(syllableCount, limit);

})
textAreaTwo.addEventListener('input', function() {
    const currentValueTwo = textAreaTwo.value;
    const limit = 7;
    var syllableCount = syllable(currentValueTwo);
    textAreaTwoCount.textContent = syllableCount + "/7";
    textAreaTwoCount.style.color = syllableColor(syllableCount, limit);
})
textAreaThree.addEventListener('input', function() {
    const currentValueThree = textAreaThree.value;
    const limit = 5;
    var syllableCount = syllable(currentValueThree);
    textAreaThreeCount.textContent = syllableCount + "/5";
    textAreaThreeCount.style.color = syllableColor(syllableCount, limit);
})

// Submit the haiku via fetch so the page never navigates away
const haikuForm = document.getElementById('haikuForm');
const formErrors = document.getElementById('formErrors');

function renderErrors(container, errors) {
    container.innerHTML = '';
    container.classList.toggle('has-errors', errors.length > 0);
    errors.forEach(function (error) {
        const p = document.createElement('p');
        p.className = 'notice';
        p.textContent = error;
        container.appendChild(p);
    });
}

function resetCounts() {
    textAreaOneCount.textContent = '0/5';
    textAreaOneCount.style.color = 'white';
    textAreaTwoCount.textContent = '0/7';
    textAreaTwoCount.style.color = 'white';
    textAreaThreeCount.textContent = '0/5';
    textAreaThreeCount.style.color = 'white';
}

haikuForm.addEventListener('submit', async function (e) {
    // prevents page reload on submit
    e.preventDefault();

    const response = await fetch('/submit', {
        method: 'POST',
        body: new URLSearchParams(new FormData(haikuForm)),
    });
    const data = await response.json();

    renderErrors(formErrors, data.errors || []);

    // add support for submission failure here
    if (data.success) {
        haikuForm.reset();
        resetCounts();
        showSuccessPopup();
    }
});
// ^^^^^^^ SUMIBT CODE ^^^^^^^^^^



// VVVVVVVVV LOAD CODE VVVVVVVVV
const loadAreaOne = document.getElementById('loadLineOne');
const loadAreaTwo = document.getElementById('loadLineTwo');
const loadAreaThree = document.getElementById('loadLineThree');
const loadHaiku = document.getElementById('loadHaiku');
const loadButton = document.getElementById('loadButton');
const loadAuthor = document.getElementById('loadAuthor');
const loadErrors = document.getElementById('loadErrors');
const deleteButton = document.getElementById('deleteButton');

function displayHaiku(data){
    loadAreaOne.textContent = data.lineOne;
    loadAreaTwo.textContent = data.lineTwo;
    loadAreaThree.textContent = data.lineThree;

    const authorName = data.authorName && data.authorName.trim() ? data.authorName : '(empty)';
    loadAuthor.textContent = authorName + ' (' + data.authorTag + ')';

    loadHaiku.dataset.haikuId = data.haikuId;
    loadHaiku.classList.remove('hidden');
    deleteButton.classList.remove('hidden');
}

function clearLoadedHaiku(){
    loadAreaOne.textContent = '';
    loadAreaTwo.textContent = '';
    loadAreaThree.textContent = '';
    loadAuthor.textContent = '';

    loadHaiku.dataset.haikuId = '';
    loadHaiku.classList.add('hidden');
    deleteButton.classList.add('hidden');
}

loadButton.addEventListener('click', debounce(async function (e) {
    e.preventDefault();

    const response = await fetch ('/load', {
        method: 'GET'
    });
    const data = await response.json();

    renderErrors(loadErrors, data.errors || []);

    if(data.success){
        displayHaiku(data);
    }

}, 1000));

deleteButton.addEventListener('click', async function () {
    const haikuId = loadHaiku.dataset.haikuId;
    if (!haikuId) return;

    const confirmed = await showConfirm('Are you sure you want to delete this haiku? This cannot be undone.');
    if (!confirmed) return;

    const superDuperConfirmed = await showConfirm('Are you super duper sure?');
    if (!superDuperConfirmed) return;

    const response = await fetch('/delete/' + encodeURIComponent(haikuId), {
        method: 'DELETE'
    });
    const data = await response.json();

    renderErrors(loadErrors, data.errors || []);

    if (data.success) {
        clearLoadedHaiku();
    }
});

// ^^^^^^^^^ LOAD CODE ^^^^^^^^^^^



// VVVVVVVVV GENERATE CODE VVVVVVVVV
const generateAreaOne = document.getElementById('generateLineOne');
const generateAreaTwo = document.getElementById('generateLineTwo');
const generateAreaThree = document.getElementById('generateLineThree');
const generatedHaiku = document.getElementById('generatedHaiku');
const generateButton = document.getElementById('generateButton');
const generateErrors = document.getElementById('generateErrors');

function displayGeneratedHaiku(data) {
    generateAreaOne.textContent = data.lineOne;
    generateAreaTwo.textContent = data.lineTwo;
    generateAreaThree.textContent = data.lineThree;

    generatedHaiku.classList.remove('hidden');
}

generateButton.addEventListener('click', debounce(async function (e) {
    e.preventDefault();

    const response = await fetch('/generate', {
        method: 'GET'
    });
    const data = await response.json();

    renderErrors(generateErrors, data.errors || []);

    if (data.success) {
        displayGeneratedHaiku(data);
    }
}, 1000));
// ^^^^^^^^^ GENERATE CODE ^^^^^^^^^^



// VVVVVVVVV TEXT TO SPEECH CODE VVVVVVVVV
const LINE_PAUSE_MS = 700;

// native <textarea> elements can't contain markup, so word-by-word highlighting
// isn't possible there - those fall back to a whole-box highlight instead
const containerHighlightElements = [textAreaOne, textAreaTwo, textAreaThree];
// the loaded/generated haikus are plain <p> tags we control, so we can wrap
// each word in its own <span> and highlight them one at a time as speech reaches them
const wordHighlightElements = [loadAreaOne, loadAreaTwo, loadAreaThree, generateAreaOne, generateAreaTwo, generateAreaThree];

function clearWordHighlight(el) {
    el.querySelectorAll('.speaking-word').forEach(function (span) {
        span.classList.remove('speaking-word');
    });
}

function clearHighlights() {
    containerHighlightElements.forEach(function (el) {
        el.classList.remove('speaking');
    });
    wordHighlightElements.forEach(clearWordHighlight);
}

function wrapWordsInSpans(el, text) {
    el.innerHTML = '';
    const words = text.split(/\s+/).filter(Boolean);
    words.forEach(function (word, i) {
        const span = document.createElement('span');
        span.className = 'word';
        span.textContent = word;
        el.appendChild(span);
        if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
    return el.querySelectorAll('span.word');
}

// entries: array of { text, el, words } - words: true means el supports
// word-span highlighting, otherwise el gets a whole-box highlight instead
function speakLines(entries) {
    if (!('speechSynthesis' in window)) return;

    const cleanEntries = entries
        .map(function (entry) { return { text: entry.text.trim(), el: entry.el, words: entry.words }; })
        .filter(function (entry) { return entry.text; });

    if (!cleanEntries.length) return;

    // stop anything currently being read before starting a new pass
    speechSynthesis.cancel();
    clearHighlights();

    let index = 0;
    function speakNext() {
        if (index >= cleanEntries.length) {
            clearHighlights();
            return;
        }

        const entry = cleanEntries[index];
        const utterance = new SpeechSynthesisUtterance(entry.text);
        const wordSpans = entry.words ? wrapWordsInSpans(entry.el, entry.text) : null;
        let wordPointer = 0;

        utterance.onstart = function () {
            if (!entry.words) entry.el.classList.add('speaking');
        };
        utterance.onboundary = function (event) {
            if (!wordSpans || (event.name && event.name !== 'word')) return;
            if (wordPointer > 0 && wordSpans[wordPointer - 1]) {
                wordSpans[wordPointer - 1].classList.remove('speaking-word');
            }
            if (wordSpans[wordPointer]) {
                wordSpans[wordPointer].classList.add('speaking-word');
            }
            wordPointer++;
        };
        utterance.onend = function () {
            entry.el.classList.remove('speaking');
            if (wordSpans) clearWordHighlight(entry.el);
            index++;
            setTimeout(speakNext, LINE_PAUSE_MS);
        };
        speechSynthesis.speak(utterance);
    }
    speakNext();
}

const writeSpeakerButton = document.getElementById('writeSpeakerButton');
writeSpeakerButton.addEventListener('click', function () {
    speakLines([
        { text: textAreaOne.value, el: textAreaOne, words: false },
        { text: textAreaTwo.value, el: textAreaTwo, words: false },
        { text: textAreaThree.value, el: textAreaThree, words: false },
    ]);
});

const loadSpeakerButton = document.getElementById('loadSpeakerButton');
loadSpeakerButton.addEventListener('click', function () {
    speakLines([
        { text: loadAreaOne.textContent, el: loadAreaOne, words: true },
        { text: loadAreaTwo.textContent, el: loadAreaTwo, words: true },
        { text: loadAreaThree.textContent, el: loadAreaThree, words: true },
    ]);
});

const generateSpeakerButton = document.getElementById('generateSpeakerButton');
generateSpeakerButton.addEventListener('click', function () {
    speakLines([
        { text: generateAreaOne.textContent, el: generateAreaOne, words: true },
        { text: generateAreaTwo.textContent, el: generateAreaTwo, words: true },
        { text: generateAreaThree.textContent, el: generateAreaThree, words: true },
    ]);
});
// ^^^^^^^^^ TEXT TO SPEECH CODE ^^^^^^^^^^



const successPopup = document.getElementById('successPopup');
const popupClose = document.getElementById('popupClose');

function showSuccessPopup() {
    successPopup.classList.add('show');
}

// VVVVVVVVV CUSTOM CONFIRM MODAL CODE VVVVVVVVV
const confirmModal = document.getElementById('confirmModal');
const confirmMessage = document.getElementById('confirmMessage');
const confirmYesButton = document.getElementById('confirmYesButton');
const confirmNoButton = document.getElementById('confirmNoButton');

// shows the modal with the given message and resolves true/false based on
// which button (or the overlay, treated as cancel) the user clicks
function showConfirm(message) {
    return new Promise(function (resolve) {
        confirmMessage.textContent = message;
        confirmModal.classList.remove('hidden');

        function cleanup(result) {
            confirmModal.classList.add('hidden');
            confirmYesButton.removeEventListener('click', onYes);
            confirmNoButton.removeEventListener('click', onNo);
            confirmModal.removeEventListener('click', onOverlayClick);
            resolve(result);
        }
        function onYes() { cleanup(true); }
        function onNo() { cleanup(false); }
        function onOverlayClick(e) {
            if (e.target === confirmModal) cleanup(false);
        }

        confirmYesButton.addEventListener('click', onYes);
        confirmNoButton.addEventListener('click', onNo);
        confirmModal.addEventListener('click', onOverlayClick);
    });
}
// ^^^^^^^^^ CUSTOM CONFIRM MODAL CODE ^^^^^^^^^^

popupClose.addEventListener('click', function () {
    successPopup.classList.remove('show');
});
