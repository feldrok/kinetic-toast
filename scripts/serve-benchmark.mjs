import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const port = Number(process.env.PORT ?? 4173);
const host = process.env.HOST ?? "localhost";

const mimeTypes = new Map([
	[".css", "text/css; charset=utf-8"],
	[".html", "text/html; charset=utf-8"],
	[".js", "text/javascript; charset=utf-8"],
	[".json", "application/json; charset=utf-8"],
	[".map", "application/json; charset=utf-8"],
	[".mjs", "text/javascript; charset=utf-8"],
	[".svg", "image/svg+xml"],
]);

const resolveRequestPath = (url) => {
	const pathname = decodeURIComponent(new URL(url, `http://${host}:${port}`).pathname);
	const normalizedPath = normalize(pathname).replace(/^([/\\])+/, "");
	const filePath = resolve(join(root, normalizedPath || "benchmarks/react-stress.html"));

	if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
		return null;
	}

	return filePath;
};

const server = createServer((request, response) => {
	if (!request.url) {
		response.writeHead(400).end("Bad request");
		return;
	}

	let filePath = resolveRequestPath(request.url);

	if (!filePath) {
		response.writeHead(403).end("Forbidden");
		return;
	}

	if (existsSync(filePath) && statSync(filePath).isDirectory()) {
		filePath = join(filePath, "index.html");
	}

	if (!existsSync(filePath) || !statSync(filePath).isFile()) {
		response.writeHead(404).end("Not found");
		return;
	}

	response.writeHead(200, {
		"Cache-Control": "no-store",
		"Content-Type": mimeTypes.get(extname(filePath)) ?? "application/octet-stream",
	});
	createReadStream(filePath).pipe(response);
});

server.listen(port, host, () => {
	console.log(`Benchmark server running at http://${host}:${port}/benchmarks/react-stress.html`);
});
