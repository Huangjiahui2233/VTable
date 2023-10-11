# 行高列宽

在数据分析领域，表格是一种常见的数据展示方式。正确设置表格的行高列宽对于提高数据可读性和美观性具有重要意义。本教程将围绕 VTable 中的表格行高列宽计算功能，带了解如何正确配置行高和列宽以满足实际需求。

# 行高配置

## 默认行高

在 VTable 中，您可以为整个表格设置一个统一的默认行高值。默认行高可以通过 `defaultRowHeight` 配置项进行设置。以下代码示例展示了如何设置默认行高为 50：

```javascript
const table = new VTable.ListTable({
  defaultRowHeight: 50
});
```

## 表头默认行高

除了默认行高的设置，VTable 还支持针对表头的行高进行设置。通过 `defaultHeaderRowHeight` 配置项进行设置，该配置项可以设定为一个数组，分别对应各级表头行的高度，或者一个数值统一设置表格各行高度。以下代码示例展示了如何设置一级表头行高为 30，二级表头行高为 40：

```javascript
const table = new VTable.ListTable({
  defaultHeaderRowHeight: [30, 40],
});
```

# 列宽配置

## 默认列宽

在 VTable 中，您可以设置一个统一的默认列宽值。默认列宽可以通过 `defaultColWidth` 配置项进行设置。以下代码示例展示了如何设置列宽为 100：

```javascript
const table = new VTable.ListTable({
  defaultColWidth: 100,
});
```

## 行表头默认列宽

除了默认列宽的设置，VTable还支持针对行表头的列宽进行设置。通过`defaultHeaderColWidth`配置项进行设置，该配置项可以设定为一个，分别对应各级行表头列的宽度。以下代码示例展示了如何设置一级行表头列宽为 50，二级行表头列宽为 60：

```javascript
const table = new VTable.ListTable({
  defaultHeaderColWidth: [50, 60],
});
```

## 列宽限制配置：maxWidth+minWidth

在配置列宽的过程中，您可能遇到需要限制某一列最大或最小列宽的场景。VTable 提供了 `maxWidth` 和 `maxWidth` 配置项，用于限制每一列的最大和最小列宽。以下代码示例展示了如何设置某一列的最大列宽为 200，最小列宽为 50：

```javascript
const table = new VTable.ListTable({
  columns: [
    {
      // ...其他配置项
      maxWidth: 200,
      minWidth: 50,
    },
  ],
});
```

## 列宽限制配置：limitMaxAutoWidth

当使用“自动宽度模式”时，可能需要限制计算出的最大列宽。通过 `limitMaxAutoWidth` 配置项进行设置，可以避免某一列宽度过大导致的显示异常。`limitMaxAutoWidth` 配置项支持设定一个具体的数值或布尔类型，如果设置为true或者没有设置该配置则使用450来限制最大列宽。例如设置限制最大列宽为 500：

```javascript
 table = new VTable.ListTable({
  // ...其他配置项
  limitMaxAutoWidth: 500,
});
```

## 列宽撑满容器：autoFillWidth
配置项 autoFillWidth，用于控制是否自动撑满容器宽度。区别于宽度模式`widthMode`的`adaptive`的自适应容器的效果，autoFillWidth控制的是只有当列数较少的时候，表格可以自动撑满容器宽度，但是当列数超过容器的时候根据真实情况来定列宽可出现滚动条。
```javascript
const table = new VTable.ListTable({
  autoFillWidth: true
});
```

## 行高撑满容器：autoFillHeight
配置项 autoFillHeight，用于控制是否自动撑满容器高度。区别于高度模式`heightMode`的`adaptive`的自适应容器的效果，autoFillHeight 控制的是只有当行数较少的时候，表格可以自动撑满容器高度，但是当行数超过容器的时候根据真实情况来定行高可出现滚动条。
```javascript
const table = new VTable.ListTable({
  autoFillHeight: true
});
```

# 列宽计算模式

在 VTable 中，表格列宽度的计算模式`widthMode`可以配置为 `standard`（标准模式）、`adaptive`（自适应容器宽度模式）或 `autoWidth`（自动列宽模式）。[demo示例](https://visactor.io/vtable/demo/basic-functionality/width-mode-autoWidth)

- 标准模式（standard）：表格使用`width` 属性指定的宽度作为列宽度，如未指定，则采用 `defaultColWidth`或`defaultHeaderColWidth ` 设定的默认列宽。
- 自适应容器宽度模式（adaptive）：在自适应容器宽度模式下表格使用容器的宽度分配列宽度(每列宽度的比例基于standard模式中的宽度值)。[demo示例](https://visactor.io/vtable/demo/basic-functionality/width-mode-adaptive)
- 自动列宽模式（autoWidth）：在自动宽度模式下，根据列头和 body 单元格中的内容自动计算列宽度，忽略设置的 `width` 属性和 `defaultColWidth`。

# 行高计算模式

表格行高度的计算模式`heightMode`也可以配置为 `standard`（标准模式）、`adaptive`（自适应容器宽度模式）或 `autoHeight`（自动行高模式）。

- 标准模式（standard）：采用 `defaultRowHeight` 及 `defaultHeaderRowHeight` 作为行高。
- 自适应容器高度模式（adaptive）：使用容器的高度分配每行高度。
- 自动行高模式（autoHeight）：根据内容自动计算行高，计算依据fontSize和lineHeight。相关搭配设置项`autoWrapText`自动换行，可以根据换行后的多行文本内容来计算行高。

至此，我们已经介绍了 VTable 中的表格行高列宽计算功能，包括行高、列宽配置，以及表格宽度模式。通过掌握这些功能，您可以更便捷地 VTable 中进行数据展示与分析，现各种实际需求。