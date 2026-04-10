import React from 'react';
import { Tree, Splitter } from 'antd';


export const Test: React.FC = () => (
  <Splitter style={{ boxShadow: '0 0 10px rgba(0, 0, 0, 0.1)' }}>
    <Splitter.Panel defaultSize={240} min={240} max={480}>
      {/* 左侧文件夹树 数据由笔记目录和笔记组成 */}
      {/* 固定只有2层第一层目录，第二层笔记，选项的最右边是省略号 icon 点击出现下拉菜单*/}
      <Tree />
    </Splitter.Panel>
    <Splitter.Panel>
      {/* 右侧内容区 从上到下*/}
      {/* 笔记面包屑 + 功能icon */}
      {/* 笔记编辑区域 */}
    </Splitter.Panel>
  </Splitter>
);
