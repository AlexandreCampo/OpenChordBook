/* SPDX-License-Identifier: MIT
 * Copyright (c) 2017 Michael Daumling; modifications (c) 2026 Alexandre Campo.
 * See THIRD_PARTY_NOTICES.md and licenses/ for full upstream notices.
 */
/**
 * The Playlist and Song instances are derivates from 
 * 
 * https://github.com/pianosnake/ireal-reader
 * 
 * The Song instance has been modified slightly, mostly to exclude the parsing
 * music into single notes. The constructor accepts the content of a iReal Pro
 * HTML file and filles its "songs" property with all songs found in that
 * playlist.
 */

class Playlist {
	constructor(data){
		if (typeof data !== 'string' || data.length > 10 * 1024 * 1024) throw new Error('Playlist file too large (10 MB maximum).');
		// Prefer the actual link: a chart title may itself contain "irealb://".
		const link = /href\s*=\s*"(irealb:\/\/[^\"]*)"/i.exec(data);
		if (link) data = link[1];
		const start = data.indexOf('irealb://');
		if (start < 0) throw new Error('No playlist link found.');
		const end = data.indexOf('"', start);
		const encoded = data.slice(start + 9, end < 0 ? data.length : end);
		if (encoded.length > 6 * 1024 * 1024) throw new Error('Playlist link too large (6 MB maximum).');
		let percentDecoded = decodeURIComponent(encoded);
		if (percentDecoded.length > 3 * 1024 * 1024) throw new Error('Decoded playlist too large (3 MB maximum).');
		let parts = percentDecoded.split("===");
		if (parts.length > 2001) throw new Error('Playlist has too many tunes (2000 maximum).');  //songs are separated by ===
		if (parts.length > 1) this.name = parts.pop();  //playlist name
		if (this.name && this.name.length > 512) throw new Error('Playlist name too long (512 characters maximum).');
		this.songs = parts.map(x => new Song(x));
	}
}

class Song {
	constructor(data) {
		this.cells = [];
		if (!data) {
			this.title = "";
			this.composer = "";
			this.style = "";
			this.key = "";
			this.transpose = 0;
			this.exStyle = "";
			this.bpm = 0;
			this.repeats = 0;
			this.music = "";
			return;
		}
		let parts = data.split("="); //split on one sign, remove the blanks
		let musicPrefix = "1r34LbKcu7";
		this.title = parts[0];
		this.composer = parts[1];
		this.style = parts[3];
		this.key = parts[4];
		this.transpose = +parts[5] || 0;
		this.exStyle = parts[7];
		this.bpm = +parts[8] || 0;
		this.repeats = +parts[9] || 3;
		const music = parts[6];
		if (typeof music !== 'string') throw new Error('Missing chart data');
		if (music.length > 16384 + musicPrefix.length) throw new Error('Chart too large (16384 characters maximum).');
		if (music.startsWith(musicPrefix)) {
			this.music = this.unscramble(music.slice(musicPrefix.length));
		} else if (/^[|{\[]/.test(music)) {
			// Some exports contain a short, unencoded draft (e.g. "[Eb ").
			// Keep the source's partial chart instead of rejecting its playlist.
			this.music = music;
		} else {
			throw new Error('Unsupported chart data');
		}
	}

	//unscrambling hints from https://github.com/ironss/accompaniser/blob/master/irealb_parser.lua
	//strings are broken up in 50 character segments. each segment undergoes character substitution addressed by obfusc50()
	unscramble(s) {
		let r = '', p;

		while(s.length > 50){
			p = s.substring(0, 50);
			s = s.substring(50);
			if(s.length < 2){
				r = r + p;
			}else{
				r = r + this.obfusc50(p);
			}
		}
		r = r + s;
		return r;
	}

	obfusc50(s) {
		//the first 5 characters are switched with the last 5
		let newString = s.split('');
		for(let i = 0; i < 5; i++){
			newString[49 - i] = s[i];
			newString[i] = s[49 - i];
		}
		//characters 10-24 are also switched
		for(let i = 10; i < 24; i++){
			newString[49 - i] = s[i];
			newString[i] = s[49 - i];
		}
		return newString.join('');
	}
}

if (typeof module !== "undefined")
	module.exports = Playlist;
