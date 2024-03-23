const BackendUrl = 'https://github.com/sub-store-org/Sub-Store/releases/latest/download/sub-store.bundle.js'
const FrontendUrl = 'https://github.com/sub-store-org/Sub-Store-Front-End/releases/latest/download/dist.zip'
const SUBSTORE_PATH = 'data/third/sub-store'
const PID_FILE = SUBSTORE_PATH + '/sub-store.pid'
const SUB_STORE_FRONTEND_PATH = SUBSTORE_PATH + '/frontend'
const SUB_STORE_BACKEND_PATH = SUBSTORE_PATH + '/sub-store.bundle.js'

/**
 * 启动Sub-Store服务
 */
const startSubStoreService = () => {
  return new Promise(async (resolve, reject) => {
    const { env } = Plugins.useEnvStore()
    let backendFlag = false
    let timeout = true
    setTimeout(() => timeout && reject('启动Sub-Store服务超时'), 5000)
    const pid = await Plugins.ExecBackground(
      'node',
      [env.basePath + '\\' + SUB_STORE_BACKEND_PATH],
      (out) => {
        if (out.includes('[sub-store] INFO: [BACKEND]')) {
          backendFlag = true
        }
        if (out.includes('[sub-store] INFO: [FRONTEND]') && backendFlag) {
          Plugins.Writefile(PID_FILE, pid.toString())
          timeout = false
          resolve()
        }
      },
      async () => {
        await Plugins.Writefile(PID_FILE, '0')
      },
      {
        env: {
          SUB_STORE_BACKEND_API_HOST: Plugin.SUB_STORE_BACKEND_API_HOST,
          SUB_STORE_FRONTEND_HOST: Plugin.SUB_STORE_FRONTEND_HOST,
          SUB_STORE_FRONTEND_API_PORT: Plugin.SUB_STORE_FRONTEND_API_PORT,
          SUB_STORE_BACKEND_API_PORT: Plugin.SUB_STORE_BACKEND_API_PORT,
          SUB_STORE_FRONTEND_PATH: env.basePath + '\\' + SUB_STORE_FRONTEND_PATH,
          SUB_STORE_DATA_BASE_PATH: env.basePath + '\\' + SUBSTORE_PATH
        }
      }
    )
  })
}

/**
 * 停止Sub-Store服务
 */
const stopSubStoreService = async () => {
  const pid = await Plugins.ignoredError(Plugins.Readfile, PID_FILE)
  if (pid && pid !== '0') {
    await Plugins.ignoredError(Plugins.KillProcess, Number(pid))
    await Plugins.Writefile(PID_FILE, '0')
  }
}

/**
 * 检测Sub-Store是否在运行
 */
const isSubStoreRunning = async () => {
  const pid = await Plugins.ignoredError(Plugins.Readfile, PID_FILE)
  return pid && pid !== '0'
}

/**
 * 下载Sub-Store前端和后端文件
 */
const InstallSubStore = async () => {
  const id = Plugins.message.info('正在执行安装Sub-Store...', 999999).id;
  const tmpZip = 'data/.cache/sub-store.zip';
  const tmpDir = 'data/.cache/sub-store-frontend';

  try {
    await downloadResource('前端', FrontendUrl, tmpZip, id);
    await extractAndMove(tmpZip, tmpDir, SUB_STORE_FRONTEND_PATH, id, '前端');
    await downloadResource('后端', BackendUrl, SUB_STORE_BACKEND_PATH, id);
    Plugins.message.update(id, '安装后端完成', 'success');
  } finally {
    Plugins.message.destroy(id);
  }
};

/**
 * 下载并安装Sub-Store前端文件
 */
const InstallSubStoreFrontend = async () => {
  const id = Plugins.message.info('正在下载安装Sub-Store前端...', 999999).id;
  const tmpZip = 'data/.cache/sub-store-frontend.zip';
  const tmpDir = 'data/.cache/sub-store-frontend';

  try {
    await downloadResource('前端', FrontendUrl, tmpZip, id);
    await extractAndMove(tmpZip, tmpDir, SUB_STORE_FRONTEND_PATH, id, '前端');
    Plugins.message.update(id, '安装前端完成', 'success');
  } catch (error) {
    Plugins.message.update(id, `安装前端失败: ${error}`, 'error');
  } finally {
    cleanUp(tmpDir, tmpZip, id);
  }
};

/**
 * 下载并安装Sub-Store后端文件
 */
const InstallSubStoreBackend = async () => {
  const id = Plugins.message.info('正在下载安装Sub-Store后端...', 999999).id;

  try {
    await downloadResource('后端', BackendUrl, SUB_STORE_BACKEND_PATH, id);
    Plugins.message.update(id, '安装后端完成', 'success');
  } catch (error) {
    Plugins.message.update(id, `安装后端失败: ${error}`, 'error');
  } finally {
    Plugins.message.destroy(id);
  }
};

// Helper functions
const downloadResource = async (type, url, destination, messageId) => {
  Plugins.message.update(messageId, `正在下载${type}资源`);
  await Plugins.Download(url, destination, (current, total) => {
    Plugins.message.update(messageId, `正在下载${type}资源...` + ((current / total) * 100).toFixed(2) + '%');
  });
};

const extractAndMove = async (zipPath, extractPath, destinationPath, messageId, type) => {
  Plugins.message.update(messageId, `${type}资源下载完成，正在解压...`);
  await Plugins.sleep(1000);
  await Plugins.UnzipZIPFile(zipPath, extractPath);
  await Plugins.Makedir(SUBSTORE_PATH);
  await Plugins.Movefile(`${extractPath}/dist`, destinationPath);
  await Plugins.Removefile(extractPath);
  await Plugins.Removefile(zipPath);
};

const cleanUp = async (dirPath, zipPath, messageId) => {
  await Plugins.Removefile(dirPath);
  await Plugins.Removefile(zipPath);
  await Plugins.sleep(1000);
  Plugins.message.destroy(messageId);
};

/**
 * 插件钩子 - 点击安装按钮时
 */
const onInstall = async () => {
  await InstallSubStore()
  return 0
}

/**
 * 插件钩子 - 点击卸载按钮时
 */
const onUninstall = async () => {
  if (await isSubStoreRunning()) {
    throw '请先停止Sub-Store服务！'
  }
  await Plugins.confirm('确定要删除Sub-Store吗？', '配置文件将不会保留！')
  await Plugins.Removefile(SUBSTORE_PATH)
  return 0
}

/**
 * 插件钩子 - 点击运行按钮时
 */
const onRun = async () => {
  if (!(await isSubStoreRunning())) {
    if (!(await Plugins.ignoredError(Plugins.Exec, 'node', ['-v']))) {
      throw '检测到系统未安装Nodejs环境，请先安装。'
    }
    await startSubStoreService()
  }
  const url = 'http://127.0.0.1:' + Plugin.SUB_STORE_FRONTEND_API_PORT + '?api=http://127.0.0.1:' + Plugin.SUB_STORE_BACKEND_API_PORT
  Plugin.useInternalBrowser ? open(url) : Plugins.BrowserOpenURL(url)
  return 1
}

/**
 * 插件钩子 - 启动APP时
 */
const onStartup = async () => {
  if (Plugin.AutoStartOrStop && !(await isSubStoreRunning())) {
    await startSubStoreService()
    return 1
  }
}

/**
 * 插件钩子 - 关闭APP时
 */
const onShutdown = async () => {
  if (Plugin.AutoStartOrStop && (await isSubStoreRunning())) {
    await stopSubStoreService()
    return 2
  }
}

/**
 * 插件菜单项 - 启动服务
 */
const Start = async () => {
  if (await isSubStoreRunning()) {
    throw '当前服务已经在运行了'
  }
  if (!(await Plugins.ignoredError(Plugins.Exec, 'node', ['-v']))) {
    throw '检测到系统未安装Nodejs环境，请先安装。'
  }
  await startSubStoreService()
  Plugins.message.success('✨Sub-Store 启动成功!')
  return 1
}

/**
 * 插件菜单项 - 停止服务
 */
const Stop = async () => {
  if (!(await isSubStoreRunning())) {
    throw '当前服务并未在运行'
  }
  await stopSubStoreService()
  Plugins.message.success('停止Sub-Store成功')
  return 2
}

/**
 * 更新Sub-Store前端文件
 */
const UpdateSubStoreFrontend = async (shouldRestart) => {
  const id = Plugins.message.info('正在更新Sub-Store前端...', 999999).id;
  try {
    await Plugins.Removefile(SUB_STORE_FRONTEND_PATH); // 删除旧的前端文件
    await InstallSubStoreFrontend(); // 重新安装Sub-Store前端
    Plugins.message.update(id, '更新Sub-Store前端完成', 'success');
    if (shouldRestart) await restartSubStoreService(); // 如果之前是启动状态，则重新启动
    return 1;
  } catch (error) {
    Plugins.message.update(id, `更新失败: ${error}`, 'error');
    return 2;
  } finally {
    Plugins.message.destroy(id);
  }
};

/**
 * 更新Sub-Store后端文件
 */
const UpdateSubStoreBackend = async (shouldRestart) => {
  const id = Plugins.message.info('正在更新Sub-Store后端...', 999999).id;
  try {
    await Plugins.Removefile(SUB_STORE_BACKEND_PATH); // 删除旧的后端文件
    await InstallSubStoreBackend(); // 重新安装Sub-Store后端
    Plugins.message.update(id, '更新Sub-Store后端完成', 'success');
    if (shouldRestart) await restartSubStoreService(); // 如果之前是启动状态，则重新启动
    return 1;
  } catch (error) {
    Plugins.message.update(id, `更新失败: ${error}`, 'error');
    return 2;
  } finally {
    Plugins.message.destroy(id);
  }
};

/**
 * 共用逻辑：检查服务状态并更新
 */
const updateService = async (updateFunction, shouldRestart) => {
  const running = await isSubStoreRunning();
  if (running) await stopSubStoreService(); // 若服务正在运行，则先停止
  const result = await updateFunction(shouldRestart);
  if (running) await restartSubStoreService(); // 如果服务之前正在运行，则重新启动
  return result;
};

/**
 * 插件菜单项 - 更新前端服务
 */
const UpdateFrontend = async () => {
  return updateService(UpdateSubStoreFrontend, true);
};

/**
 * 插件菜单项 - 更新后端服务
 */
const UpdateBackend = async () => {
  return updateService(UpdateSubStoreBackend, true);
};

// Helper function to restart the Sub-Store service
const restartSubStoreService = async () => {
  await startSubStoreService();
  Plugins.message.success('Sub-Store服务已重新启动');
};
