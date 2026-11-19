import { mkdtemp, readFile, writeFile, copyFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const source = 'https://www.kaggle.com/api/v1/models/google/movenet/tfJs/multipose-lightning/1/download';
const hashes = {
  'model.json': '7d1875fc5508a0e094de7f4c6a9ab8037680fde8f1c8780da9b09d966983ae7a',
  'group1-shard1of3.bin': '67b47c89fdec3307e0523e7e9854ea762e7e8f332c71e7a255d94eff96b37f7c',
  'group1-shard2of3.bin': '44e8bcd60443be39f69c53242324bdf1ef7e19a934816097e00f05792c71baa5',
  'group1-shard3of3.bin': 'bebbeadc125f787f07948865c88d1a998d9f3fc1f67e1ecaa7e76f8e5fdf8bf0',
};
const target = fileURLToPath(new URL('../public/models/movenet/', import.meta.url));
const exec = promisify(execFile);
const temporary = await mkdtemp(join(tmpdir(), 'cameragames-model-'));
try {
  console.log('Downloading Google MoveNet MultiPose Lightning v1…');
  const response = await fetch(source, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`Model download HTTP ${response.status}`);
  const archive = join(temporary, 'model.tar.gz');
  await writeFile(archive, Buffer.from(await response.arrayBuffer()));
  const { stdout } = await exec('tar', ['-tzf', archive]);
  for (const entry of stdout.trim().split(/\r?\n/)) {
    if (!(entry in hashes)) throw new Error(`Unexpected archive entry: ${entry}`);
  }
  await exec('tar', ['-xzf', archive, '-C', temporary]);
  for (const [name, expected] of Object.entries(hashes)) {
    const actual = createHash('sha256').update(await readFile(join(temporary, name))).digest('hex');
    if (actual !== expected) throw new Error(`Checksum mismatch: ${name}`);
  }
  await mkdir(target, { recursive: true });
  for (const name of Object.keys(hashes)) await copyFile(join(temporary, name), join(target, name));
  console.log('Verified all four files. Model is ready for local serving.');
} finally {
  await rm(temporary, { recursive: true, force: true });
}
