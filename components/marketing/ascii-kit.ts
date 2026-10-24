/**
 * The asciify-engine pieces the landing page uses, gathered in one module that the components
 * load with import() after the page has rendered. Named imports keep it to these few parts of the
 * kit, and nothing here touches the DOM until a component calls one of them in an effect.
 */
export { background, swell } from "asciify-engine/kit";
