import { startServer } from "./server.js";

const PORT = Number(process.env.PORT) || 3001;

startServer(PORT).then(() => {
    console.log(`Regicide server listening on http://localhost:${PORT}`);
});
