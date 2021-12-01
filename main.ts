import { Plugin, MarkdownPostProcessorContext } from 'obsidian';
import { request } from "http";
import { JSDOM } from 'jsdom';

function domOnload(dom: HTMLElement) {
	return new Promise((resolve, reject) => {
		dom.onload = resolve;
		dom.onerror = reject;
	});
}

class RenderD3 {
	template: string;
	version: number

	constructor(version: number) {
		this.version = version;
		this.template = `
		<!DOCTYPE html>
		<html lang="en">
		<head>
			<script src="https://d3js.org/d3.v${version}.min.js" charset="utf-8"></script>
			<title>Document</title>
		</head>
		<body>
		</body>
		</html>
		`;
	}

	async getSVG(htmlText: string): Promise<string> {
		let jsdom = new JSDOM(this.template, { runScripts: "dangerously", resources: "usable" });
		return new Promise((resolve, reject) => {
			domOnload(jsdom.window.document.body).then(()=>{
				try {
					jsdom.window.eval(htmlText);
					resolve(jsdom.window.document.body.innerHTML);
				} catch (err) {
					reject(err)
				}
			}).catch((err) => {
				reject(err);
			});
		});
	}
}

export default class MyPlugin extends Plugin {
	async d3Processor_http(source: string, el: HTMLElement, _: MarkdownPostProcessorContext): Promise<void> {
		let resData: string;

		let req = request({
			host: "127.0.0.1",
			port: 3021,
			method: "POST",
			path: "/d3",
			headers: {
				"Content-type": "text/plain",
				"Content-Length": Buffer.byteLength(source)
			}
		}, (res) => {
			res.on('data', (chunk) => {
				resData += chunk;
			});
			res.on('end', () => {
				el.innerHTML = resData;
			});
		});

		req.on('error', (e) => {
			console.error(`problem with request: ${e.message}`);
		});

		req.write(source);
		req.end();
	}

	async d3Processor(source: string, el: HTMLElement, _: MarkdownPostProcessorContext): Promise<void> {

		let d3version = 6;
		source.split("\n").filter((value: string) => {
			// looks for comment
			return value.trim().startsWith("//"); 
		}).forEach((value: string) => {
			// search settings
			if(value.contains("@version:"))
			{
				let values = value.split(":");
				let setVer = Number(values[1]);
				if (setVer >= 2 && setVer <= 7)
					d3version = setVer
			}
		});

		let render = new RenderD3(d3version);
		render.getSVG(source).then((text:string) => {
			el.insertAdjacentHTML('beforeend', text);
		}).catch((error:ErrorEvent) => {
			el.insertAdjacentHTML('beforeend', 
				`<div style='background-color:black;color:white'>
					obsidian-d3 ERROR.</br>
					${error}
				</div>`
			);
		});	
	}

	async onload() {
		this.registerMarkdownCodeBlockProcessor("d3", this.d3Processor);
	}

	onunload() {

	}
}


