# 前端编码规范 (TypeScript + Next.js)

> 面向 AI agent 和开发者，适用于 `frontend/` 目录下的所有代码。
>
> 参考来源：[Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)、[TypeScript Style Guide by mkosir](https://mkosir.github.io/typescript-style-guide/)、[Next.js Best Practices](https://www.serviots.com/blog/nextjs-development-best-practices)

---

## 一、TypeScript 通用规范

### 类型系统

- 开启**严格模式** — `tsconfig.json` 中设置 `"strict": true`
- 利用 TypeScript 类型推断，不要冗余声明显而易见的类型
- **禁止使用 `any`** — 用 `unknown` 加类型收窄，或定义明确的类型
- 尽量减少类型断言（`as`）和非空断言（`!`），优先使用运行时检查
- 用 `import type` 导入仅类型引用，方便 tree-shaking
- 不可变数据使用 `Readonly` 和 `ReadonlyArray`，返回新数据而非修改原数据
- 不赋值的属性标记为 `readonly`
- 优先使用 `interface` 定义对象结构；`type` 用于联合类型、交叉类型等场景
- 常量使用 `as const`；需要类型校验时使用 `as const satisfies Type`
- **避免使用 `enum`** — 用字面量联合类型或 `as const` 对象替代，减少运行时代码
- 用 `null` 表示"显式无值"（赋值、返回值），用 `undefined` 表示"值不存在"（表单字段、请求参数）
- 用判别联合类型（discriminated unions）建模复杂数据，替代大量可选属性
- API 响应类型放在 `types/` 目录下集中管理

### 函数

- 函数应职责单一、无副作用、同样输入产生同样输出
- 多参数时优先使用单个对象参数，提高可读性和扩展性
- 最大化必填参数，减少可选参数；如果可选参数太多，拆分成多个函数
- 公共 API 和导出函数**显式声明返回类型**，提高安全性和可重构性
- 优先使用**函数声明**（`function foo()`）定义命名函数
- 嵌套函数或回调使用**箭头函数**
- 不要用 `function` 表达式（除非 generator 或需要动态 `this` 绑定）

### 变量

- 默认使用 `const`，需要重新赋值时使用 `let`，**禁止使用 `var`**
- 布尔变量加 `is`、`has`、`should` 等前缀（如 `isLoading`、`hasError`）
- 互斥状态用联合类型替代多个布尔值（如 `type Status = "idle" | "loading" | "error" | "success"`）

### 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 变量 / 函数 | camelCase | `filterProductsByType`、`isLoading` |
| 常量 | CONSTANT_CASE | `MAX_RETRY_COUNT`、`API_BASE_URL` |
| 类 / 接口 / 类型 | PascalCase | `OrderStatus`、`PlayerProps` |
| 泛型 | T + 描述性名称 | `TRequest`、`TResponse` |
| 缩写词 | 视为完整单词 | `loadHttpUrl`（不是 `loadHTTPURL`） |
| 文件名 | 与导出内容匹配 | `Player.tsx`、`useAudioPlayer.ts` |

- 不要用前导/尾随下划线（`_name`）或 `I` 前缀（`IPlayer`）
- 名字不要重复类型信息（如 `nameString` 是多余的，直接用 `name`）

### 字符串

- 普通字符串使用**单引号**
- 拼接或多行字符串使用**模板字面量**
- 不要用字符串拼接 (`+`)

### 控制流

- 控制语句（`if`、`for`、`while`）**必须加花括号**
- 数组遍历使用 `for...of`，避免 `for...in`
- 使用严格等于（`===`、`!==`）；唯一例外：与 `null` 比较时可用 `==`
- **禁止使用 `@ts-ignore`** — 用类型修正或 `@ts-expect-error`（仅限测试）

### 异常处理

- 只抛出 `Error` 实例，不要抛出字符串或其他值
- 空 `catch` 块必须加注释说明原因
- `try` 块保持精简，不可能抛异常的代码移到外面

### 注释

- 用 `/** JSDoc */` 写面向使用者的文档
- 用 `//` 写实现细节注释
- 注释解释"为什么"而非"是什么" — 优先让代码自解释
- 公共 API、库代码、可复用代码加 TSDoc 注释

### 导入

- 项目内使用**相对导入**（`./`、`../`）；跨模块共享代码使用**绝对导入**（`@/`）
- 导入自动排序（通过 ESLint 或 Prettier 插件）
- **优先使用命名导出**，避免默认导出，保证导入一致性

---

## 二、React 组件规范

### 组件结构

- 一个文件一个组件，文件名与组件名一致（`Player.tsx` 导出 `Player`）
- 只用**函数组件** — 不要用 class 组件
- 组件内代码顺序：导入 → 类型定义 → 组件定义 → Hooks → 事件处理 → 渲染逻辑
- 保持组件精简，超过约 150 行就拆分

### Props

- 最大化必填 props，减少可选 props
- 互斥的 props 组合使用判别联合类型，避免无效的 props 组合
- 不要从 props 派生 state；如必要，prop 加 `initial` 前缀（如 `initialValue`）
- 回调 props 用 `on` 前缀（`onClick`），处理函数用 `handle` 前缀（`handleClick`）
- Props 类型用 `Props` 后缀（如 `PlayerProps`）

### Hooks

- 自定义 Hooks 放在 `hooks/` 目录
- camelCase + `use` 前缀（`useAudioPlayer`）
- `useState` 返回值使用对称命名（`[value, setValue]`）
- 自定义 Hook 返回**对象**而非数组（方便按名取值）

### 状态管理 & 数据流

- 只传必要的 props，不要层层透传无关数据
- 本地 UI 状态使用 `useState` / `useReducer`
- 优先使用组合（composition）和本地状态，全局状态（Context、Zustand）作为最后手段
- 筛选/排序等状态优先放在 URL 参数中

---

## 三、Next.js 规范

- 使用 **App Router**（`app/` 目录），不要用 Pages Router
- 所有页面和布局**默认是 Server Components** — 只有需要浏览器 API、事件处理或 Hooks 时才加 `"use client"`
- 图片使用 `next/image`，导航使用 `next/link`
- 共享布局放在 `app/layout.tsx`，不要在各页面重复
- 不要把所有代码堆在 `app/` 目录 — 业务逻辑、工具函数、类型定义放到对应目录

---

## 四、样式

- 使用 **Tailwind CSS** — 不要用 CSS Modules、styled-components 或行内 style 对象
- 移动端优先的响应式设计（`sm:`、`md:`、`lg:` 断点）

---

## 五、目录结构

```
frontend/
├── app/                    # Next.js App Router 页面
│   ├── layout.tsx          # 根布局
│   ├── page.tsx            # 首页
│   └── archive/
│       └── page.tsx        # 往期列表
├── components/             # 共享 UI 组件
├── hooks/                  # 自定义 React Hooks
├── types/                  # TypeScript 类型定义
├── lib/                    # 工具函数（API 客户端、格式化等）
├── public/                 # 静态资源
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 六、禁止事项

- 禁止使用 `any`、`var`、`@ts-ignore`、`enum`
- 禁止使用 class 组件、`function` 表达式定义组件
- 禁止使用默认导出（优先命名导出）
- 禁止提交 `.env.local` — 只提交 `.env.example` 并使用占位值
