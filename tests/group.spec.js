const { test, expect } = require('@playwright/test');

test.describe('分组功能测试', () => {
  test.beforeEach(async ({ page }) => {
    // 访问应用
    await page.goto('http://localhost:5001');
    await page.waitForLoadState('networkidle');
  });

  test('创建分组', async ({ page }) => {
    console.log('测试：创建分组');
    
    // 点击新建分组按钮（侧边栏的+新建按钮）
    const newGroupBtn = await page.locator('button[title="新建分组"]');
    await expect(newGroupBtn).toBeVisible();
    
    // 监听对话框
    page.once('dialog', async dialog => {
      console.log('对话框:', dialog.message());
      await dialog.accept('测试分组');
    });
    
    await newGroupBtn.click();
    
    // 等待分组出现
    await page.waitForTimeout(1000);
    
    // 检查分组是否创建成功
    const groupName = await page.locator('.group-name:has-text("测试分组")');
    await expect(groupName).toBeVisible();
    
    console.log('✅ 创建分组成功');
  });

  test('编辑分组', async ({ page }) => {
    console.log('测试：编辑分组');
    
    // 先创建分组
    page.once('dialog', async dialog => {
      await dialog.accept('编辑测试分组');
    });
    await page.click('button:has-text("新建")');
    await page.waitForTimeout(1000);
    
    // 点击编辑按钮
    page.once('dialog', async dialog => {
      console.log('编辑对话框:', dialog.message());
      await dialog.accept('已编辑分组');
    });
    
    await page.click('.group-actions button[title="编辑"]');
    await page.waitForTimeout(1000);
    
    // 检查分组名称是否更新
    const editedGroup = await page.locator('.group-name:has-text("已编辑分组")');
    await expect(editedGroup).toBeVisible();
    
    console.log('✅ 编辑分组成功');
  });

  test('删除分组', async ({ page }) => {
    console.log('测试：删除分组');
    
    // 先创建分组
    page.once('dialog', async dialog => {
      await dialog.accept('删除测试分组');
    });
    await page.click('button:has-text("新建")');
    await page.waitForTimeout(1000);
    
    // 监听确认对话框
    page.once('dialog', async dialog => {
      console.log('确认对话框:', dialog.message());
      await dialog.accept();
    });
    
    // 点击删除按钮
    await page.click('.group-actions button[title="删除"]');
    await page.waitForTimeout(1000);
    
    // 检查分组是否消失
    const deletedGroup = await page.locator('.group-name:has-text("删除测试分组")');
    await expect(deletedGroup).not.toBeVisible();
    
    console.log('✅ 删除分组成功');
  });

  test('拖拽任务到分组', async ({ page }) => {
    console.log('测试：拖拽任务到分组');
    
    // 先创建分组
    page.once('dialog', async dialog => {
      await dialog.accept('拖拽目标分组');
    });
    await page.click('button:has-text("新建")');
    await page.waitForTimeout(1000);
    
    // 检查是否有未分组任务
    const ungroupedItems = await page.locator('#ungroupedList .group-item');
    const count = await ungroupedItems.count();
    
    if (count === 0) {
      console.log('⚠️ 没有未分组任务，跳过拖拽测试');
      return;
    }
    
    // 获取第一个任务
    const firstItem = ungroupedItems.first();
    const taskName = await firstItem.textContent();
    console.log('拖拽任务:', taskName);
    
    // 获取目标分组
    const targetGroup = await page.locator('.group-header').first();
    
    // 执行拖拽
    await firstItem.dragTo(targetGroup);
    await page.waitForTimeout(2000);
    
    // 检查任务是否移动到分组
    const groupCount = await page.locator('.group-section .group-item').count();
    expect(groupCount).toBeGreaterThan(0);
    
    console.log('✅ 拖拽任务成功');
  });
});

test.describe('AI分析测试', () => {
  test('分析视频并查看结果', async ({ page }) => {
    console.log('测试：AI分析视频');
    
    // 配置API（如果未配置）
    const settingsBtn = await page.locator('button:has-text("⚙️")');
    await settingsBtn.click();
    
    // 检查是否需要配置
    const apiKeyInput = await page.locator('#apiKey');
    const apiKey = await apiKeyInput.inputValue();
    
    if (!apiKey || apiKey.length < 10) {
      console.log('⚠️ 请先配置API Key');
      return;
    }
    
    // 返回主界面
    await page.click('button:has-text("返回")');
    
    // 输入视频链接
    await page.fill('#videoUrl', 'https://www.bilibili.com/video/BV1GJ411x7h7');
    
    // 点击开始分析
    await page.click('button:has-text("开始分析")');
    
    // 等待分析完成（最多5分钟）
    console.log('等待分析完成...');
    await page.waitForSelector('.result-page.active', { timeout: 300000 });
    
    // 检查结果
    const summary = await page.locator('#summaryContent');
    await expect(summary).not.toBeEmpty();
    
    console.log('✅ AI分析成功');
  });
});
