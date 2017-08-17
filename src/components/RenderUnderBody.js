import { PureComponent } from 'react';
import ReactDOM from 'react-dom';

export default class RenderUnderBody extends PureComponent {
  componentDidMount() {
    this.container = document.createElement('div');
    document.body.appendChild(this.container);
    this.renderReal();
  }


  componentDidUpdate() {
    this.renderReal();
  }


  componentWillUnmount() {
    ReactDOM.unmountComponentAtNode(this.container);
    document.body.removeChild(this.container);
  }


  renderReal() {
    ReactDOM.render(this.props.children, this.container)
  }


  render() {
    return null;
  }
}
