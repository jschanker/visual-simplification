// Create the single magnifier element once when the script loads
const magnifier = document.createElement('div');
magnifier.id = 'dynamic-magnifier';
document.body.appendChild(magnifier);

// Variable to hold the timeout for hiding the magnifier, to prevent flickering
let hideTimeout = null;
// Global variable to keep track of the currently hovered word span
let currentHoveredWordSpan = null;

/**
 * Shows the magnifier with the given text and positions it over the provided bounding rectangle.
 * @param {string} textToMagnify - The text content to display in the magnifier.
 * @param {DOMRect} rect - The bounding rectangle of the text to be magnified.
 */
function showMagnifier(textToMagnify, rect) {
    // Clear any pending hide timeout, as we are about to show the magnifier
    if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
    }

    // Only proceed if there's actual text to magnify
    if (!textToMagnify || textToMagnify.trim().length === 0) {
        hideMagnifier();
        return;
    }

    // Update the magnifier's text content
    magnifier.textContent = textToMagnify;

    // Get current scroll position for accurate absolute positioning
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    // Set initial position and dimensions of the magnifier to match the target rect
    // Ensure positions are non-negative
    magnifier.style.left = `${Math.max(0, rect.left + scrollX)}px`;
    magnifier.style.top = `${Math.max(0, rect.top + scrollY)}px`;

    // Set max width to prevent going off screen, calculated dynamically
    //magnifier.style.maxWidth = `calc(100vw - ${Math.max(0, rect.left + scrollX)}px)`; // Use 100vw for viewport width

    // Set the specific font size requested (72px)
    magnifier.style.fontSize = `72px`;

    // Add 'active' class to trigger the CSS transition for visibility
    magnifier.classList.add('active');

    // Use requestAnimationFrame to ensure the browser has time to calculate
    // the magnifier's new dimensions after text content is set, before centering.
    requestAnimationFrame(() => {
        const magnifierWidth = magnifier.offsetWidth;
        const magnifierHeight = magnifier.offsetHeight;

        // Adjust position to center the magnifier over the target rectangle
        // Ensure positions are non-negative after centering adjustment
        magnifier.style.left = `${Math.max(0, rect.left + scrollX + (rect.width / 2) - (magnifierWidth / 2))}px`;
        magnifier.style.top = `${Math.max(0, rect.top + scrollY + (rect.height / 2) - (magnifierHeight / 2))}px`;

        // Apply overflow: scroll if text wrapping was removed. If text wrapping is enabled, this might not be needed.
        // It's in style.css now, so removing direct style assignment here.
        // magnifier.style.overflow = `scroll`;

        // Recalculate max width after final positioning to avoid going off screen from the left
        //magnifier.style.maxWidth = `calc(100vw - ${Math.max(0, rect.left + scrollX + (rect.width / 2) - (magnifierWidth / 2))}px)`;

        // console.log debugging removed for production-ready code.
        // console.log(magnifier, magnifier.style.maxWidth, magnifier.getBoundingClientRect());
    });
}

/**
 * Hides the magnifier by removing its 'active' class.
 */
function hideMagnifier() {
    magnifier.classList.remove('active');
}

// Define common text-containing tags that we want to process for word wrapping
const textContainerTags = ['P', 'SPAN', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'A', 'LI', 'STRONG', 'EM', 'CODE'];

/**
 * Wraps individual words within text nodes of a given element with <span> tags.
 * This function is called recursively to handle nested text.
 * @param {HTMLElement} element - The element whose text content needs to be processed.
 */
function wrapWordsInElement(element) {
    // Create a NodeIterator to traverse only text nodes
    const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        null, // No custom filter function
        false // Not expandEntityReferences
    );

    let node;
    const textNodesToProcess = [];

    // Collect all text nodes first to avoid modifying the DOM while iterating
    while ((node = walker.nextNode())) {
        // Ensure the text node is not empty or just whitespace
        if (node.textContent.trim().length > 0) {
            textNodesToProcess.push(node);
        }
    }

    for (const textNode of textNodesToProcess) {
        const parent = textNode.parentNode;
        if (!parent) continue; // Should not happen for nodes in the DOM

        // Skip if the parent is already our magnifier or a script/style tag
        if (parent.id === 'dynamic-magnifier' || Array.from(parent.classList).includes('magnifiable-word') || parent.nodeName === 'SCRIPT' || parent.nodeName === 'STYLE') {
            continue;
        }

        const fullText = textNode.textContent;
        // Regex to split by word boundaries, keeping words and non-word separators
        // This ensures whitespace and punctuation are preserved as separate nodes.
        //const parts = fullText.match(/\b[\S]+\b|\W+/g);
        const parts = fullText.match(/\S+|\s+/g);

        if (!parts || parts.length === 0) continue;

        const fragment = document.createDocumentFragment();

        for (const part of parts) {
            //if (/\b[\W]+\b/.test(part)) { // If it's a word
            if (/[\S]+/.test(part)) { // If it's a non-space
                const span = document.createElement('span');
                span.className = 'magnifiable-word'; // Add a class for easy identification
                span.textContent = part;
                fragment.appendChild(span);
            } else { // If it's whitespace or punctuation
                fragment.appendChild(document.createTextNode(part));
            }
        }
        parent.replaceChild(fragment, textNode);
    }
}

/**
 * Initializes the word wrapping on page load.
 */
function initializeWordWrapping() {
    // Get all elements that are potential text containers
    const elements = document.querySelectorAll(textContainerTags.join(', '));
    elements.forEach(element => {
        // Only process elements that are not the magnifier itself
        if (element.id !== 'dynamic-magnifier') {
            wrapWordsInElement(element);
        }
    });
}

// Call initializeWordWrapping once the DOM is fully loaded
// Use 'interactive' state to ensure DOM is mostly ready, but not necessarily all images loaded.
// This is often sufficient for content scripts.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeWordWrapping);
} else {
    // DOMContentLoaded has already fired
    initializeWordWrapping();
}


// Event listener for mouseover on the entire document body using event delegation
document.body.addEventListener('mouseover', (event) => {
    const target = event.target;

    // Check if the hovered element is one of our magnifiable word spans
    if (target && target.classList && target.classList.contains('magnifiable-word')) {
        // If we're already hovering over this exact word span, do nothing
        if (target === currentHoveredWordSpan) {
            return;
        }

        currentHoveredWordSpan = target; // Update the currently hovered word span

        const wordsBefore = 2;
        const wordsAfter = 2;
        const phraseElements = []; // This will store the actual word spans for the phrase
        let currentElement = target;
        let count = 0;

        // Collect preceding word spans
        // Iterate backwards, adding magnifiable-word spans until 'wordsBefore' count is met
        // or we hit the beginning of the parent element.
        while (currentElement && currentElement.previousSibling && count < wordsBefore) {
            currentElement = currentElement.previousSibling;
            // Skip over non-word text nodes (whitespace, punctuation) that are not part of the phrase
            if (currentElement.nodeType === Node.TEXT_NODE && currentElement.textContent.trim().length === 0) {
                 // If it's just whitespace, keep iterating
                 continue;
            } else if (currentElement.nodeType === Node.TEXT_NODE) {
                // If it's text that is not just whitespace (e.g., punctuation or combined words),
                // it should probably be part of the phrase, but we are looking for 'magnifiable-word' spans.
                // For simplicity, we currently stop if it's not a word span or pure whitespace.
                break;
            }
            
            // If it's a magnifiable word span, add it and increment count
            if (currentElement.nodeType === Node.ELEMENT_NODE && currentElement.classList.contains('magnifiable-word')) {
                phraseElements.unshift(currentElement); // Add to the beginning to maintain order
                count++;
            } else {
                // Stop if we hit a non-word, non-text element (e.g., <br>, <img>) or an element
                // that was not wrapped (e.g. bold tag not handled in wrapping logic).
                break;
            }
        }

        // Reset currentElement to the target word for collecting succeeding words
        currentElement = target;
        phraseElements.push(target); // Add the target word itself

        count = 0; // Reset count for succeeding words
        // Collect succeeding word spans
        // Iterate forwards, adding magnifiable-word spans until 'wordsAfter' count is met
        // or we hit the end of the parent element.
        while (currentElement && currentElement.nextSibling && count < wordsAfter) {
            currentElement = currentElement.nextSibling;
            // Skip over non-word text nodes (whitespace, punctuation) that are not part of the phrase
            if (currentElement.nodeType === Node.TEXT_NODE && currentElement.textContent.trim().length === 0) {
                // If it's just whitespace, keep iterating
                continue;
            } else if (currentElement.nodeType === Node.TEXT_NODE) {
                // Similar to preceding, stop if it's not a word span or pure whitespace
                break;
            }
            
            // If it's a magnifiable word span, add it and increment count
            if (currentElement.nodeType === Node.ELEMENT_NODE && currentElement.classList.contains('magnifiable-word')) {
                phraseElements.push(currentElement);
                count++;
            } else {
                // Stop if we hit a non-word, non-text element
                break;
            }
        }

        // Create a range encompassing all collected phrase elements to get their combined bounding box and text
        if (phraseElements.length > 0) {
            const combinedRange = document.createRange();
            combinedRange.setStartBefore(phraseElements[0]);
            combinedRange.setEndAfter(phraseElements[phraseElements.length - 1]);

            const phraseText = combinedRange.toString();
            const phraseRect = combinedRange.getBoundingClientRect();

            showMagnifier(phraseText, phraseRect);
        } else {
            hideMagnifier();
        }

    } else {
        // If not hovering over a magnifiable-word span, hide the magnifier
        hideMagnifier();
        currentHoveredWordSpan = null;
    }
});

// Event listener for mouseout on the entire document body
document.body.addEventListener('mouseout', (event) => {
    // Clear any pending hide timeout
    if (hideTimeout) {
        clearTimeout(hideTimeout);
    }

    // Set a small delay before hiding the magnifier.
    // This helps prevent flickering when the mouse moves rapidly between adjacent words,
    // giving the next mouseover event a chance to fire and cancel this hide.
    hideTimeout = setTimeout(() => {
        const newTarget = event.relatedTarget; // The element the mouse is moving to

        // Hide if the mouse has moved outside the document, or to the magnifier itself,
        // OR if the new target is not a descendant of the parent of the last hovered word span.
        // This ensures the magnifier stays visible when moving between words within the same phrase,
        // but hides when leaving the active text area.
        if (!newTarget || newTarget.id === 'dynamic-magnifier' ||
            (currentHoveredWordSpan && !currentHoveredWordSpan.parentNode.contains(newTarget))) {
            hideMagnifier();
            currentHoveredWordSpan = null;
        }
    }, 50); // 50ms delay
});

// Hide magnifier if the window is resized or scrolled to prevent mispositioning
window.addEventListener('scroll', hideMagnifier);
window.addEventListener('resize', hideMagnifier);