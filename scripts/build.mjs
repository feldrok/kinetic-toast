import {
	copyFileSync,
	mkdirSync,
	readFileSync,
	rmSync,
	watch,
	writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const packagePath = new URL("../package.json", import.meta.url);
const sourceCssPath = new URL("../src/styles.css", import.meta.url);
const distCssPath = new URL("../dist/styles.css", import.meta.url);
const distPath = new URL("../dist", import.meta.url);
const buncheeBin = fileURLToPath(
	new URL(
		process.platform === "win32"
			? "../node_modules/.bin/bunchee.cmd"
			: "../node_modules/.bin/bunchee",
		import.meta.url,
	),
);
const originalPackageJson = readFileSync(packagePath, "utf8");
const isWatchMode = process.argv.includes("--watch");

const copyStyles = () => {
	mkdirSync(dirname(fileURLToPath(distCssPath)), { recursive: true });
	copyFileSync(sourceCssPath, distCssPath);
};

const writeBundlerPackageJson = () => {
	// Bunchee discovers JavaScript/TypeScript source entries from package exports.
	// The stylesheet export is a copied asset, so hide it while bundling and
	// restore package.json before copying the CSS into dist.
	const packageJson = JSON.parse(originalPackageJson);
	const exportsMap = packageJson.exports;

	if (exportsMap && typeof exportsMap === "object" && !Array.isArray(exportsMap)) {
		delete exportsMap["./styles.css"];
	}

	writeFileSync(packagePath, `${JSON.stringify(packageJson, null, "\t")}\n`);
};

const restorePackageJson = () => {
	writeFileSync(packagePath, originalPackageJson);
};

const run = (command, args) => {
	const result = spawnSync(command, args, { stdio: "inherit" });

	if (result.status !== 0) {
		process.exitCode = result.status ?? 1;
		throw new Error(`${command} ${args.join(" ")} failed`);
	}
};

const runWatch = () => {
	rmSync(distPath, { recursive: true, force: true });
	writeBundlerPackageJson();

	const child = spawn(buncheeBin, ["--watch"], { stdio: "inherit" });
	const cssWatcher = watch(sourceCssPath, copyStyles);

	copyStyles();

	const cleanup = () => {
		cssWatcher.close();
		restorePackageJson();
	};

	child.on("exit", (code, signal) => {
		cleanup();

		if (signal) {
			process.kill(process.pid, signal);
			return;
		}

		process.exit(code ?? 0);
	});

	for (const signal of ["SIGINT", "SIGTERM"]) {
		process.once(signal, () => {
			child.kill(signal);
		});
	}
};

if (isWatchMode) {
	runWatch();
} else {
	try {
		rmSync(distPath, { recursive: true, force: true });
		writeBundlerPackageJson();
		run(buncheeBin, []);
	} finally {
		restorePackageJson();
	}

	copyStyles();
}
