import '@testing-library/jest-dom';

// jsdom has no layout engine, so it doesn't implement scrollIntoView. Any
// component that scrolls something into view (MonthView's charts panel) would
// otherwise throw during render.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

beforeEach(() => {
  localStorage.clear();
});
