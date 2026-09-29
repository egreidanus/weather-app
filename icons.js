
const lucide = {
    createIcons() {
        document.querySelectorAll('i[data-lucide]').forEach(function (placeholder) {
            const name = placeholder.dataset.lucide;
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.setAttribute('width', '24');
            svg.setAttribute('height', '24');
            svg.setAttribute('fill', 'none');
            svg.setAttribute('stroke', 'currentColor');
            svg.setAttribute('stroke-width', '2');
            svg.setAttribute('stroke-linecap', 'round');
            svg.setAttribute('stroke-linejoin', 'round');
            svg.setAttribute('aria-hidden', 'true');
            svg.setAttribute('focusable', 'false');
            svg.setAttribute('class', `lucide lucide-${name} ${placeholder.className}`.trim());
            placeholder.replaceWith(svg);
        });
    }
};
