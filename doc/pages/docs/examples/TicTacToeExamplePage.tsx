import React from 'react';
import DocMdxPage from '../../../components/DocMdxPage';
import Content, { frontmatter } from '../../../content/examples/tictactoe.mdx';

const TicTacToeExamplePage = () => <DocMdxPage Content={Content} meta={frontmatter} />;

export default TicTacToeExamplePage;
