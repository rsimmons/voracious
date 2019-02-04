import { PureComponent } from 'react';

export default class AnnoText extends PureComponent {
  handleCopy = (e) => {
    // Do not intercept if there is a proper selection in document
    const selection = document.getSelection();
    if (selection && selection.toString()) { // using toString instead of isCollapsed handles selections in inputs
      return;
    }

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
