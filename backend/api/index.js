// Route every /api/* request through the shared handler. The query parameter
// preserves nested paths on Vercel projects using the "Other" preset.
export { default } from './[...route].js';
