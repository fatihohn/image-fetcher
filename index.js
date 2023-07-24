import axios from "axios";
import readline from "readline";
import fs from "fs";
import path from "path";

class ImageFetcher {
  dir = "./img";
  subdir = "";
  url = "";
  domain = "";
  index = 0;

  readline = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  constructor() {
    this.argv = process.argv.slice(2);
    this.url = this.argv[0];
    this.domain = this.url.split("/")[2];
    this.subdir = `${this.dir}/${this.domain}`;
    this.lastIndex = parseInt(this.findLatestFile(this.subdir));
    this.index = Number.isNaN(this.lastIndex) ? 0 : this.lastIndex + 1;

    if (!fs.existsSync(this.dir)) {
      fs.mkdirSync(this.dir);
    }

    if (!fs.existsSync(this.subdir)) {
      fs.mkdirSync(this.subdir);
    }

    while (fs.existsSync(`${this.subdir}/${this.index}`)) {
      this.index++;
    }

    if (!fs.existsSync(`${this.subdir}/${this.index}`)) {
      fs.mkdirSync(`${this.subdir}/${this.index}`);
    }
  }

  findLatestFile(directoryPath) {
    fs.readdir(directoryPath, (err, files) => {
      if (err) {
        console.error("Error reading directory:", err);
        return;
      }

      let latestFile = "";
      let latestFileMtime = 0;

      files.forEach((file) => {
        const filePath = path.join(directoryPath, file);

        fs.stat(filePath, (err, stats) => {
          if (err) {
            console.error("Error getting file stats:", err);
            return;
          }

          if (stats.isFile() && stats.mtimeMs > latestFileMtime) {
            latestFile = file;
            latestFileMtime = stats.mtimeMs;
          }
        });
      });

      return latestFile;
    });
  }

  async _httpGet(url = this.url, option = {}) {
    return await axios.get(url, option);
  }

  getFileExtensionFromArrayBuffer(arrayBuffer) {
    const view = new DataView(arrayBuffer.buffer);

    if (view.getUint32(0, false) === 0x89504e47) {
      return ".png";
    } else if (view.getUint16(0, false) === 0xffd8) {
      return ".jpg";
    } else if (view.getUint16(0, false) === 0x4749) {
      return ".gif";
    } else if (view.getUint16(0, false) === 0x424d) {
      return ".bmp";
    } else if (view.getUint16(0, false) === 0x2550) {
      return ".pdf";
    }

    return null;
  }

  async getImages() {
    const { data } = await this._httpGet();

    const regex = /<img\s+src="([^"]+)"[^>]*>/g;
    const matches = data.match(regex);

    if (matches) {
      const srcAttributes = matches.map(
        (match) => match.match(/<img\s+src="([^"]+)"/)[1]
      );
      const images = [];

      while (srcAttributes.length > 0) {
        const { data } = await this._httpGet(srcAttributes.pop(), {
          responseType: "arraybuffer",
        });
        images.push(data);
        console.log(images.length);
      }

      images.sort((a, b) => b.byteLength - a.byteLength);
      images.forEach((item, i) => {
        const ext = this.getFileExtensionFromArrayBuffer(item);
        if (ext) {
          fs.writeFileSync(`${this.subdir}/${this.index}/${i}${ext}`, item);
        }
      });

      console.log(
        `${images.length} images created at: ${this.subdir}/${this.index}`
      );
    } else {
      console.log("No img tags found in the HTML.");
    }
  }
}

const imageFetcher = new ImageFetcher();

imageFetcher.getImages().then(() => {
  process.exit();
});
