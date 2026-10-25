import { spawn } from 'child_process';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { IExecutionResult, ProgrammingLanguage } from '../types/cse.js';

export interface ExtraCodeFile {
  name: string;
  content: string;
}

export class CodeExecutionService {
  /**
   * Executes source code in an isolated temporary directory with timeout constraints.
   */
  public static async execute(
    language: ProgrammingLanguage,
    code: string,
    stdinInput: string = '',
    timeoutMs: number = 7000,
    targetFileName?: string,
    extraFiles?: ExtraCodeFile[]
  ): Promise<IExecutionResult> {
    const runId = crypto.randomBytes(6).toString('hex');
    const tempDir = path.join(os.tmpdir(), `cse-exec-${runId}`);

    try {
      await fs.mkdir(tempDir, { recursive: true });

      // Write any additional files from the session into the workspace directory
      if (extraFiles && Array.isArray(extraFiles)) {
        for (const file of extraFiles) {
          if (file.name && typeof file.content === 'string') {
            const cleanName = path.basename(file.name);
            await fs.writeFile(path.join(tempDir, cleanName), file.content, 'utf-8');
          }
        }
      }

      if (language === 'cpp') {
        return await this.executeCpp(tempDir, code, stdinInput, timeoutMs, targetFileName);
      } else if (language === 'python') {
        return await this.executePython(tempDir, code, stdinInput, timeoutMs, targetFileName);
      } else {
        return {
          stdout: '',
          stderr: `Language '${language}' execution is not supported. Use 'cpp' or 'python'.`,
          exitCode: 1,
          executionTime: 0,
          status: 'RUNTIME_ERROR'
        };
      }
    } catch (err: any) {
      return {
        stdout: '',
        stderr: `Execution setup error: ${err.message}`,
        exitCode: 1,
        executionTime: 0,
        status: 'RUNTIME_ERROR'
      };
    } finally {
      // Clean up temporary files
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup failures
      }
    }
  }

  private static getGppCommand(): string {
    if (process.platform === 'win32') {
      const candidates = [
        'g++',
        'C:\\MinGW\\bin\\g++.exe',
        'C:\\msys64\\mingw64\\bin\\g++.exe',
        'C:\\msys64\\ucrt64\\bin\\g++.exe'
      ];
      for (const cmd of candidates) {
        if (cmd === 'g++') return cmd;
        if (fsSync.existsSync(cmd)) return cmd;
      }
    }
    return 'g++';
  }

  private static async executeCpp(
    tempDir: string,
    code: string,
    stdinInput: string,
    timeoutMs: number,
    targetFileName?: string
  ): Promise<IExecutionResult> {
    const mainFileName = targetFileName ? path.basename(targetFileName) : 'main.cpp';
    const srcFile = path.join(tempDir, mainFileName);
    const isWindows = process.platform === 'win32';
    const binFile = path.join(tempDir, isWindows ? 'program.exe' : 'program');

    // Write current target file
    await fs.writeFile(srcFile, code, 'utf-8');

    // Collect all cpp files in the directory
    const dirEntries = await fs.readdir(tempDir);
    const cppFiles = dirEntries.filter((f) => f.endsWith('.cpp'));

    // Check which files have `main(` function
    const hasMain = (text: string) => /\b(int|void|auto)\s+main\s*\(/.test(text);

    // Read all files content to analyze dependencies
    const fileContents = new Map<string, string>();
    for (const file of cppFiles) {
      try {
        const content = await fs.readFile(path.join(tempDir, file), 'utf-8');
        fileContents.set(file, content);
      } catch {}
    }

    const targetHasMain = hasMain(code);
    const filesToCompile: string[] = [srcFile];

    if (targetHasMain) {
      // Include companion cpp files that do NOT have main and are not already #included
      for (const file of cppFiles) {
        if (file === mainFileName) continue;
        const c = fileContents.get(file) || '';
        // If file contains #include "another.cpp", don't compile twice
        const isIncludedInTarget = code.includes(`"${file}"`) || code.includes(`<${file}>`);
        if (!isIncludedInTarget && !hasMain(c)) {
          filesToCompile.push(path.join(tempDir, file));
        }
      }
    } else {
      // Target does not have main(). Find a companion file that DOES have main()
      let mainProviderFile: string | null = null;
      if (cppFiles.includes('main.cpp') && hasMain(fileContents.get('main.cpp') || '')) {
        mainProviderFile = 'main.cpp';
      } else {
        for (const file of cppFiles) {
          if (file === mainFileName) continue;
          if (hasMain(fileContents.get(file) || '')) {
            mainProviderFile = file;
            break;
          }
        }
      }

      if (mainProviderFile) {
        filesToCompile.push(path.join(tempDir, mainProviderFile));
      }

      for (const file of cppFiles) {
        if (file === mainFileName || file === mainProviderFile) continue;
        const c = fileContents.get(file) || '';
        const isIncluded =
          code.includes(`"${file}"`) ||
          (mainProviderFile && (fileContents.get(mainProviderFile) || '').includes(`"${file}"`));
        if (!isIncluded && !hasMain(c)) {
          filesToCompile.push(path.join(tempDir, file));
        }
      }
    }

    // 1. Compile with g++ using -std=c++14 for maximum compatibility
    const compileStartTime = Date.now();
    const gppCmd = this.getGppCommand();

    const compileArgs = [
      '-std=c++14',
      '-O2',
      '-I.',
      ...filesToCompile,
      '-o',
      binFile
    ];
    if (isWindows) {
      compileArgs.push('-static-libgcc', '-static-libstdc++');
    }
    const compileResult = await this.runProcess(
      gppCmd,
      compileArgs,
      '',
      12000,
      tempDir
    );

    if (compileResult.exitCode !== 0) {
      return {
        stdout: compileResult.stdout,
        stderr: compileResult.stderr || 'Compilation failed.',
        exitCode: compileResult.exitCode,
        executionTime: Date.now() - compileStartTime,
        status: 'COMPILATION_ERROR'
      };
    }

    // 2. Run compiled binary
    const runStartTime = Date.now();
    const runResult = await this.runProcess(binFile, [], stdinInput, timeoutMs, tempDir);
    const executionTime = Date.now() - runStartTime;

    return {
      stdout: runResult.stdout,
      stderr: runResult.stderr,
      exitCode: runResult.exitCode,
      executionTime,
      status: runResult.timedOut
        ? 'TIMEOUT'
        : runResult.exitCode === 0
        ? 'SUCCESS'
        : 'RUNTIME_ERROR'
    };
  }

  private static async executePython(
    tempDir: string,
    code: string,
    stdinInput: string,
    timeoutMs: number,
    targetFileName?: string
  ): Promise<IExecutionResult> {
    const pyFileName = targetFileName ? path.basename(targetFileName) : 'script.py';
    const srcFile = path.join(tempDir, pyFileName);
    await fs.writeFile(srcFile, code, 'utf-8');

    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const runStartTime = Date.now();
    const runResult = await this.runProcess(pythonCmd, [srcFile], stdinInput, timeoutMs, tempDir);
    const executionTime = Date.now() - runStartTime;

    return {
      stdout: runResult.stdout,
      stderr: runResult.stderr,
      exitCode: runResult.exitCode,
      executionTime,
      status: runResult.timedOut
        ? 'TIMEOUT'
        : runResult.exitCode === 0
        ? 'SUCCESS'
        : 'RUNTIME_ERROR'
    };
  }

  private static runProcess(
    command: string,
    args: string[],
    input: string,
    timeoutMs: number,
    cwd?: string
  ): Promise<{ stdout: string; stderr: string; exitCode: number; timedOut: boolean }> {
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      let isSettled = false;

      const child = spawn(command, args, {
        cwd,
        windowsHide: true
      });

      const timer = setTimeout(() => {
        timedOut = true;
        try {
          if (process.platform === 'win32' && child.pid) {
            spawn('taskkill', ['/pid', child.pid.toString(), '/f', '/t']);
          } else {
            child.kill('SIGKILL');
          }
        } catch {}
      }, timeoutMs);

      // Write stdin if provided and ALWAYS close stdin to prevent processes waiting on EOF
      if (child.stdin) {
        if (input) {
          child.stdin.write(input);
        }
        child.stdin.end();
      }

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
        // Limit stdout buffer to 50KB
        if (stdout.length > 50000) {
          try {
            child.kill();
          } catch {}
        }
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
        if (stderr.length > 50000) {
          try {
            child.kill();
          } catch {}
        }
      });

      child.on('error', (err) => {
        if (isSettled) return;
        isSettled = true;
        clearTimeout(timer);
        resolve({
          stdout,
          stderr: `Process execution error: ${err.message}`,
          exitCode: 1,
          timedOut: false
        });
      });

      child.on('close', (code) => {
        if (isSettled) return;
        isSettled = true;
        clearTimeout(timer);
        resolve({
          stdout,
          stderr: timedOut ? `Execution timed out after ${timeoutMs}ms.` : stderr,
          exitCode: timedOut ? 124 : (code ?? 0),
          timedOut
        });
      });
    });
  }
}
