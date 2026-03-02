import * as registry from "./registry.js";
import * as fsTools from "../tools/filesystem.js";

registry.register(
  "read_file",
  "Read text content of a file. Path relative to allowed base. UTF-8.",
  { path: "string" },
  async (args) => fsTools.readFile(args as { path: string })
);

registry.register(
  "write_file",
  "Write text content to a file (overwrite). Path relative to allowed base.",
  { path: "string", content: "string" },
  async (args) => fsTools.writeFile(args as { path: string; content: string })
);

registry.register(
  "list_dir",
  "List directory entries (name and type: file or dir). Path relative to allowed base.",
  { path: "string" },
  async (args) => fsTools.listDir(args as { path: string })
);

registry.register(
  "file_exists",
  "Check if a file or directory exists. Path relative to allowed base.",
  { path: "string" },
  async (args) => fsTools.fileExists(args as { path: string })
);
