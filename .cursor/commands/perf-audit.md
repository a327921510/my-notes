# /perf-audit — React 重渲染性能体检

按 `react-performance.rule.mdc` 对一段 React 代码做"重渲染开销"专项审查。

## 何时使用

- 用户反映页面卡顿
- 大列表渲染（>50 项）出现操作迟滞
- 表单输入有明显延迟
- 准备引入 React.lazy / 虚拟化前先评估当前瓶颈
- 重构前后对比性能改善

## 输入

```
/perf-audit <file path | directory | "describe symptom">

可选附加：
  --focus memo | callback | memo+callback | rerender | bundle
  --skip-pure   跳过纯展示组件检查（仅查页面入口和 Hook）
```

## 检查清单（必须全部走完）

### 1. memo 缺失
- 纯展示组件（在 `<Widget>View.tsx` / `<Widget>Card.tsx`）有没有 `memo()` 包裹
- `.map()` 中渲染的列表项组件有没有 `memo()`
- 高频更新父组件（带 `onMouseMove` / `onScroll` / 定时器）下的子组件有没有 `memo()`

### 2. memo 失效（更危险）
- `memo` 子组件收到的 **props 是不是每次渲染都是新引用**
  - 内联对象：`<Card style={{margin:8}} />`
  - 内联数组：`<Table dataSource={[...items]} />`
  - 内联函数：`<Card onClick={()=>handle(id)} />`
- 父组件的回调有没有用 `useCallback`、依赖项是否完整
- 父组件传下来的派生数据（filter、sort 结果）有没有用 `useMemo`

### 3. 列表 .map() 模式
- 是否用了 `<Item onClick={() => onSelect(item.id)} />` 这种"每个 item 都新建函数"的反模式
- 应该改为 `useCallback((id) => onSelect(id))` + 子组件内部调用 `onClick(item.id)`

### 4. 业务 Hook 返回的 action
- 业务 Hook 返回的 action 函数有没有 `useCallback` 包裹
- 没包裹会让所有调用方的 memo / useEffect 都失效

### 5. 不必要的 state 提升
- 父组件持有的 state 实际只被某个子组件用 → 应该下沉到子组件
- 高频变化的输入框 state（searchText / hovering）放在了页面入口 → 整个页面跟着重渲染

### 6. useEffect 依赖
- 依赖项遗漏（stale closure）
- 依赖项是新对象 / 新数组（无限触发）
- 应该用 `useMemo` 稳定的依赖被忘了

### 7. 过度优化（反向问题）
- 简单计算用了 `useMemo`（计算本身比 useMemo 还轻）
- 轻量组件无脑加 `memo`（浅比较开销大于重渲染）
- 直接绑到原生 DOM 元素的回调用了 `useCallback`（`<button>` 不在乎）

### 8. 大列表
- 渲染数据量是否 ≥ 100 项？是否考虑虚拟化（`@tanstack/react-virtual`）
- 是否所有项一次性渲染、未分页

### 9. Bundle / 懒加载
- 大型组件（图表、富文本编辑器、日期选择器）是否 `React.lazy()` + `<Suspense>`
- 路由是否做了 code split（项目应当已经全部用 `lazy()` 注册）

## 输出格式（严格）

```markdown
## Perf Audit: <被审目标>

### 总览
- 扫描组件数：X
- 发现性能隐患：🔴 N1（明显卡顿源）/ 🟡 N2（潜在）/ 🟢 N3（过度优化）
- 整体评估：<良好 / 有可改善空间 / 存在明显瓶颈>

### 🔴 明显卡顿源
1. **<问题类型>**（违反 react-performance.rule 第 X 节）
   - 文件：`path/to/file.tsx:N`
   - 现象：<父组件 X 状态变化时，子组件 Y 也重渲染（应该跳过）>
   - 根因：<内联函数让 memo 失效 / Hook 没 useCallback / 等>
   - 修复：
   ```tsx
   // 改成这样
   ```
   - 预期收益：<XX 场景的重渲染从 N 次降到 1 次>

### 🟡 潜在隐患
（同上格式，影响较小）

### 🟢 过度优化（可移除）
1. **<场景>**：`useMemo` 包裹了 `users.length > 0` 这种 O(1) 判断
   - 建议：直接用 `users.length > 0`

### 📋 检查清单覆盖
| 检查项 | 状态 |
|---|---|
| memo 缺失 | ✅ / ⚠️ N 处 |
| memo 失效 | ... |
| .map() 列表回调 | ... |
| Hook action useCallback | ... |
| state 提升过度 | ... |
| useEffect 依赖 | ... |
| 过度优化 | ... |
| 大列表虚拟化 | ... |
| 懒加载 / code split | ... |

### 🔬 静态分析极限
以下问题需要运行时 profile 才能确认：
- 实际重渲染次数（需 React DevTools Profiler）
- 渲染耗时分布（需 Performance 面板）
- 真实瓶颈是 JS 还是 DOM diff
建议先用 `useDeferredValue` / `useTransition` 标记可延迟更新，再 profile 验证。
```

## 行为约束

- **必须给"预期收益"**：不要只说"加 memo"，要说"避免在 X 操作时 N 个子组件重渲染"
- **必须区分"明显卡顿"和"过度优化"**：后者是反向问题，要建议**移除** memo / useCallback
- **不要建议引入新依赖**（如 TanStack Query、@tanstack/react-virtual）作为修复手段，除非问题确实只能这么解；如需引入，**单独标注**让用户决定
- **不要重写整个组件**——只标出需要改的代码块
- **静态分析有极限**：实际重渲染次数和耗时必须告知用户去 React DevTools Profiler 验证，不要假装 AI 能预测运行时数据
