import type { BlockObjectResponse } from '@notionhq/client/build/src/api-endpoints';

type RichTextItem = { plain_text: string };

// TODO: rich text formatting (bold, italic, links)
function extractText(richText: RichTextItem[]): string {
  return richText.map((t) => t.plain_text).join('');
}

function getBlockText(block: BlockObjectResponse): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (block as any)[block.type];
  return extractText(data?.rich_text ?? []);
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
        groups.push({
          kind: block.type as ListGroup['kind'],
          items: [block],
        });
      }
    } else {
      groups.push(block);
    }
  }

  return groups;
}

export default function RecipeBody({
  blocks,
}: {
  blocks: BlockObjectResponse[];
}) {
  const groups = groupBlocks(blocks);

  return (
    <div className="prose prose-neutral max-w-none dark:prose-invert">
      {groups.map((group, i) => {
        if ('kind' in group) {
          const Tag = group.kind === 'bulleted_list_item' ? 'ul' : 'ol';
          return (
            <Tag key={i}>
              {group.items.map((item) => (
                <li key={item.id}>{getBlockText(item)}</li>
              ))}
            </Tag>
          );
        }

        const block = group;
        const text = getBlockText(block);

        switch (block.type) {
          case 'heading_1':
            return <h1 key={block.id}>{text}</h1>;
          case 'heading_2':
            return <h2 key={block.id}>{text}</h2>;
          case 'heading_3':
            return <h3 key={block.id}>{text}</h3>;
          case 'paragraph':
            return text ? <p key={block.id}>{text}</p> : null;
          case 'quote':
            return <blockquote key={block.id}>{text}</blockquote>;
          case 'divider':
            return <hr key={block.id} />;
          // TODO: image blocks
          default:
            return null;
        }
      })}
    </div>
  );
}
