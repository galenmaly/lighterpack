// LP_PORT lets a worktree run the suite against its own server instead of
// whatever checkout already holds :3000.
export const testPort = process.env.LP_PORT || '3000';
export const testRoot = `http://localhost:${testPort}/`;
