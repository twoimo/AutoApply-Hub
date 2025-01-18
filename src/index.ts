import { Server } from "@qillie/wheel-micro-service";

const server = new Server(["developer", "partner"]);
server.start(__dirname, undefined, undefined, []);
