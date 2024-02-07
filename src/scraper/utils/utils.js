import fs from 'fs';
import axios from 'axios';

export async function saveList(list, filename) {
	await fs.writeFile(filename, JSON.stringify(list), err => {
		if (err) {
			console.log(err);
		}
	});
}

export function generateAdHash(adProperties) {
	const relevantProperties = [
		'znamkavozila',
		'modelvozila',
		'prevozenikm',
		'tipvozila',
		'letoReg',
		'cena',
	];
	let stringToHash = '';

	adProperties.forEach(prop => {
		if (relevantProperties.includes(prop.name)) {
			stringToHash += prop.name + prop.value;
		}
	});

	stringToHash = stringToHash.toLowerCase();
	stringToHash = stringToHash.replace(/\s/g, '_');

	return stringToHash;
}

export async function downloadImage(url, outputPath) {
	try {
		const response = await axios({
			method: 'GET',
			url: url,
			responseType: 'stream',
			headers: {
				'User-Agent':
					'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36',
				// Add Referrer if necessary
				// 'Referrer': 'https://your-referrer-site.com'
			},
		});

		const writer = fs.createWriteStream(outputPath);

		response.data.pipe(writer);

		return new Promise((resolve, reject) => {
			writer.on('finish', resolve);
			writer.on('error', reject);
		});
	} catch (error) {
		console.error(
			'An error occurred while downloading the image:',
			error.message,
		);
	}
}

export async function wait(s) {
	return new Promise(resolve => setTimeout(resolve, s * 1000));
}

export async function randomWait(min, max) {
	const randomTime = Math.random() * (max - min) + min;
	return wait(randomTime);
}
