import { PureComponent } from 'react';

export default class AnnoText extends PureComponent {
  handleCopy = (e) => {
    e.preventDefault();
    for (const {format, data} of this.props.copyData) {
      e.clipboardData.setData(format, data);
    }
  };

  componentDidMount() {
    document.body.addEventListener('copy', this.handleCopy);
  }

  componentWillUnmount() {
    document.body.removeEventListener('copy', this.handleCopy);
  }

  render() {
    return null;
  }
}
