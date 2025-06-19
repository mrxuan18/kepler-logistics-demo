module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // 处理 .mjs 文件
      webpackConfig.module.rules.push({
        test: /\.mjs$/,
        include: /node_modules/,
        type: 'javascript/auto'
      });

      // 处理 .cjs 文件
      webpackConfig.module.rules.push({
        test: /\.cjs$/,
        include: /node_modules/,
        type: 'javascript/auto'
      });

      // 修复文件加载器规则，排除不需要作为组件处理的文件
      const fileLoaderRule = webpackConfig.module.rules.find(rule => 
        rule.test && rule.test.toString().includes('svg')
      );
      
      if (fileLoaderRule) {
        fileLoaderRule.exclude = /\.(js|mjs|jsx|ts|tsx|cjs)$/;
      }

      // 确保正确解析文件扩展名
      webpackConfig.resolve.extensions = [
        '.web.mjs', '.mjs', '.web.js', '.js', '.web.ts', '.ts', 
        '.web.tsx', '.tsx', '.json', '.web.jsx', '.jsx', '.cjs'
      ];

      return webpackConfig;
    }
  },
  // 禁用热重载的某些功能，避免冲突
  devServer: {
    hot: false,
    liveReload: true
  }
};