import { build } from 'vite'
import { meta } from '../config.js'

export default function buildWorker({
  root,
  watch,
  workerInputPath,
  workerOutputPath,
  fileName,
  framework,
}) {
  const isVue = framework === 'vue'

  return new Promise(async (resolve) => {
    const aliases = meta.resolveAliases(root)

    const workerResult = await build({
      root,
      configFile: false,
      envFile: false,
      publicDir: false,
      resolve: {
        alias: Object.entries(aliases).map(([find, replacement]) => ({
          find,
          replacement,
        })),
        mainFields: isVue
          ? ['browser', 'main', 'module']
          : ['browser', 'module', 'main'],
      },
      build: {
        outDir: workerOutputPath,
        minify: false,
        emptyOutDir: false,
        target: 'es2019',
        rollupOptions: {
          input: workerInputPath,
        },
        lib: {
          entry: workerInputPath,
          formats: ['es'],
          fileName,
        },
        // package.json is the last file written to disk after
        // a watcher event. Therefore, we only need to rebuild the
        // final worker bundle after this file is in place.
        watch: watch ? { include: aliases.__vitedge_meta__ } : undefined,
      },
      plugins: [
        {
          name: 'vitedge-worker',
          buildStart() {
            if (watch) {
              // Make sure the package.json is watched
              this.addWatchFile(aliases.__vitedge_meta__)
            }
          },
          generateBundle(options, bundle) {
            // Vite lib-build adds the format to the extension.
            // This renames the output file.
            const [[key, value]] = Object.entries(bundle)
            delete bundle[key]
            value.fileName = fileName
            bundle[fileName] = value
            options.entryFileNames = fileName
          },
        },
      ],
    })

    const isWatching = Object.prototype.hasOwnProperty.call(
      workerResult,
      '_maxListeners'
    )

    if (isWatching) {
      workerResult.on('event', async ({ result }) => {
        if (result) {
          result.close()
          resolve(null)
        }
      })
    } else {
      resolve(null)
    }
  })
}