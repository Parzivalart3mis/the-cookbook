import type { BlockObjectResponse } from '@notionhq/client/build/src/api-endpoints';

type RichTextItem = {
  plain_text: string;
  href: string | null;
  annotations: {
    bold: boolean;
    italic: boolean;
    strikethrough: boolean;
    underline: boolean;
    code: boolean;
  };
};

function renderRichText(richText: RichTextItem[], { skipBold = false } = {}): React.ReactNode {
  return richText.map((span, i) => {
    const { bold, italic, strikethrough, underline, code } = span.annotations;
    const applyBold = bold && !skipBold;
    let node: React.ReactNode = span.plain_text;

    if (code)        node = <code key={i}>{node}</code>;
    if (applyBold)   node = <strong key={i}>{node}</strong>;
    if (italic)      node = <em key={i}>{node}</em>;
    if (strikethrough) node = <del key={i}>{node}</del>;
    if (underline)   node = <u key={i}>{node}</u>;
    if (span.href)   node = <a key={i} href={span.href} target="_blank" rel="noopener noreferrer">{node}</a>;

    if (!code && !applyBold && !italic && !strikethrough && !underline && !span.href) {
      node = <span key={i}>{node}</span>;
    }

    return node;
  });
}

function getBlockRichText(block: BlockObjectResponse): RichTextItem[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((block as any)[block.type]?.rich_text ?? []) as RichTextItem[];
}

type ListGroup = {
  kind: 'bulleted_list_item' | 'numbered_list_item';
  items: BlockObjectResponse[];
};

type RenderedGroup = ListGroup | BlockObjectResponse;

function groupBlocks(blocks: BlockObjectResponse[]): RenderedGroup[] {
  const groups: RenderedGroup[] = [];

  for (const block of blocks) {
    const isBulleted = block.type === 'bulleted_list_item';
    const isNumbered = block.type === 'numbered_list_item';

    if (isBulleted || isNumbered) {
      const last = groups[groups.length - 1];
      if (last && 'kind' in last && last.kind === block.type) {
        last.items.push(block);
      } else {
        groups.push({ kind: block.type as ListGroup['kind'], items: [block] });
      }
    } else {
      groups.push(block);
    }
  }

  return groups;
}

export default function RecipeBody({ blocks }: { blocks: BlockObjectResponse[] }) {
  const groups = groupBlocks(blocks);

  return (
    <div className="prose prose-neutral max-w-none dark:prose-invert">
      {groups.map((group, i) => {
        if ('kind' in group) {
          const Tag = group.kind === 'bulleted_list_item' ? 'ul' : 'ol';
          return (
            <Tag key={i}>
              {group.items.map((item) => (
                <li key={item.id}>{renderRichText(getBlockRichText(item))}</li>
              ))}
            </Tag>
          );
        }

        const block = group;
        const rich = getBlockRichText(block);
        const rendered = renderRichText(rich);
        const hasContent = rich.some((r) => r.plain_text.trim());

        switch (block.type) {
          case 'heading_1': return <h1 key={block.id}>{renderRichText(rich, { skipBold: true })}</h1>;
          case 'heading_2': return <h2 key={block.id}>{renderRichText(rich, { skipBold: true })}</h2>;
          case 'heading_3': return <h3 key={block.id}>{renderRichText(rich, { skipBold: true })}</h3>;
          case 'paragraph': return hasContent ? <p key={block.id}>{rendered}</p> : null;
          case 'quote':     return <blockquote key={block.id}>{rendered}</blockquote>;
          case 'divider':   return <hr key={block.id} />;
          // TODO: image blocks
          default:          return null;
        }
      })}
    </div>
  );
}
